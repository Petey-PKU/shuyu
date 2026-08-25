package app.shuyu.pdfocr

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.roundToInt
import kotlin.math.sqrt

private const val PROGRESS_EVENT = "onPdfOcrProgress"
private const val TARGET_LONG_EDGE = 1800
private const val MAX_BITMAP_PIXELS = 4_000_000

class ShuyuPdfOcrModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  private val activeJobs = ConcurrentHashMap<String, AtomicBoolean>()

  private val context
    get() = requireNotNull(appContext.reactContext) { "React context is unavailable" }

  override fun definition() = ModuleDefinition {
    Name("ShuyuPdfOcr")
    Events(PROGRESS_EVENT)

    Function("isAvailable") {
      true
    }

    Function("cancel") { jobId: String ->
      activeJobs[jobId]?.let {
        it.set(true)
        true
      } ?: false
    }

    AsyncFunction("recognizePdf") { filePath: String, jobId: String, promise: Promise ->
      if (filePath.isBlank()) {
        promise.reject("OCR_INVALID_INPUT", "PDF file path is required", null)
        return@AsyncFunction
      }
      val cancelled = AtomicBoolean(false)
      if (activeJobs.putIfAbsent(jobId, cancelled) != null) {
        promise.reject("OCR_JOB_EXISTS", "An OCR job with this id is already running", null)
        return@AsyncFunction
      }

      executor.execute {
        try {
          promise.resolve(recognizePdf(filePath, jobId, cancelled))
        } catch (error: Exception) {
          promise.reject("OCR_FAILED", "Unable to recognize PDF text: ${error.message}", error)
        } finally {
          activeJobs.remove(jobId)
        }
      }
    }

    OnDestroy {
      activeJobs.values.forEach { it.set(true) }
      executor.shutdownNow()
    }
  }

  private fun recognizePdf(
    filePath: String,
    jobId: String,
    cancelled: AtomicBoolean
  ): Map<String, Any> {
    val pageTexts = mutableListOf<String>()
    var processedPages = 0
    var skippedPages = 0

    openFileDescriptor(filePath).use { descriptor ->
      PdfRenderer(descriptor).use { renderer ->
        val pageCount = renderer.pageCount
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        try {
          sendProgress(jobId, 0, pageCount, 0, false)
          for (pageIndex in 0 until pageCount) {
            if (cancelled.get() || Thread.currentThread().isInterrupted) {
              return result(pageTexts, pageCount, processedPages, skippedPages, true)
            }

            val recognizedText = try {
              renderer.openPage(pageIndex).use { page ->
                val bitmap = createPageBitmap(page)
                try {
                  page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                  val image = InputImage.fromBitmap(bitmap, 0)
                  Tasks.await(recognizer.process(image)).text.trim()
                } finally {
                  bitmap.recycle()
                }
              }
            } catch (error: Exception) {
              android.util.Log.w("ShuyuPdfOcr", "Skipping page ${pageIndex + 1}: ${error.message}")
              skippedPages += 1
              ""
            }

            pageTexts.add(recognizedText)
            processedPages += 1
            sendProgress(jobId, processedPages, pageCount, skippedPages, cancelled.get())
          }
          return result(pageTexts, pageCount, processedPages, skippedPages, cancelled.get())
        } finally {
          recognizer.close()
        }
      }
    }
  }

  private fun createPageBitmap(page: PdfRenderer.Page): Bitmap {
    val longEdge = maxOf(page.width, page.height).coerceAtLeast(1)
    val initialScale = (TARGET_LONG_EDGE.toFloat() / longEdge).coerceIn(1f, 3f)
    var width = (page.width * initialScale).roundToInt().coerceAtLeast(1)
    var height = (page.height * initialScale).roundToInt().coerceAtLeast(1)
    val pixels = width.toLong() * height.toLong()
    if (pixels > MAX_BITMAP_PIXELS) {
      val reduction = sqrt(MAX_BITMAP_PIXELS.toDouble() / pixels.toDouble()).toFloat()
      width = (width * reduction).roundToInt().coerceAtLeast(1)
      height = (height * reduction).roundToInt().coerceAtLeast(1)
    }
    return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
      eraseColor(Color.WHITE)
    }
  }

  private fun openFileDescriptor(filePath: String): ParcelFileDescriptor {
    return when {
      filePath.startsWith("content://") -> context.contentResolver.openFileDescriptor(Uri.parse(filePath), "r")
        ?: throw IllegalArgumentException("Cannot open PDF content URI")
      filePath.startsWith("file://") -> {
        val path = Uri.parse(filePath).path ?: throw IllegalArgumentException("Invalid PDF file URI")
        ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
      }
      else -> ParcelFileDescriptor.open(File(filePath), ParcelFileDescriptor.MODE_READ_ONLY)
    }
  }

  private fun sendProgress(
    jobId: String,
    currentPage: Int,
    totalPages: Int,
    skippedPages: Int,
    cancelling: Boolean
  ) {
    sendEvent(
      PROGRESS_EVENT,
      mapOf(
        "jobId" to jobId,
        "currentPage" to currentPage,
        "totalPages" to totalPages,
        "skippedPages" to skippedPages,
        "cancelling" to cancelling
      )
    )
  }

  private fun result(
    pageTexts: List<String>,
    pageCount: Int,
    processedPages: Int,
    skippedPages: Int,
    cancelled: Boolean
  ): Map<String, Any> = mapOf(
    "text" to pageTexts.joinToString("\n\u000c\n"),
    "pageCount" to pageCount,
    "processedPages" to processedPages,
    "skippedPages" to skippedPages,
    "cancelled" to cancelled
  )
}
