import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseEpub } from '../src/services/epub';
import { htmlToParagraphs } from '../src/services/markup';
import { assertDrmFreeKindleFile, formatKindleParseFailure, inspectKindleFile } from '../src/services/mobi';
import { parseExtractedPdfText, pdfNeedsOcr, PdfNeedsOcrError } from '../src/services/pdfText';
import { formatPdfExtractionError } from '../src/services/pdfErrors';
import { splitTranslationText } from '../src/services/translation';
import { splitPlainText } from '../src/utils/text';

async function verifyTxt() {
  const chapters = splitPlainText(
    'Chapter 1\n\nA quiet room held a very old book.\n\nChapter 2\n\nMorning light crossed the page.',
    'Sample',
  );
  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].title, 'Chapter 1');
  assert.equal(chapters[1].title, 'Chapter 2');
  assert.ok(chapters[0].wordCount > 0);
}

async function verifyEpub() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
    <container><rootfiles><rootfile full-path="OEBPS/content.opf" /></rootfiles></container>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0"?>
    <package>
      <metadata><dc:title xmlns:dc="dc">A Small Test</dc:title><dc:creator xmlns:dc="dc">Shuyu</dc:creator></metadata>
      <manifest><item id="chapter-1" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest>
      <spine><itemref idref="chapter-1" /></spine>
    </package>`);
  zip.file('OEBPS/chapter.xhtml', `<!doctype html><html><body>
    <h1>The First Light</h1><p>The observatory was quiet &amp; warm.</p>
    <p>Mara opened the book and listened to the rain.</p>
  </body></html>`);

  const data = await zip.generateAsync({ type: 'arraybuffer' });
  const book = await parseEpub(data, 'Fallback');
  assert.equal(book.title, 'A Small Test');
  assert.equal(book.author, 'Shuyu');
  assert.equal(book.chapters.length, 1);
  assert.equal(book.chapters[0].title, 'The First Light');
  assert.match(book.chapters[0].paragraphs.join(' '), /quiet & warm/);
  let cancellationChecks = 0;
  await assert.rejects(
    () => parseEpub(data, 'Fallback', () => cancellationChecks++ > 0),
    /导入已取消/,
    'EPUB parsing must observe cancellation inside the chapter loop',
  );
}

async function verifyEpubCompatibility() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('meta-inf/CONTAINER.XML', `<?xml version="1.0"?>
    <container><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml" /></rootfiles></container>`);
  zip.file('ops/package.opf', `<?xml version="1.0"?>
    <package>
      <metadata><dc:title xmlns:dc="dc">Encoded Paths</dc:title><dc:creator xmlns:dc="dc">A Reader</dc:creator></metadata>
      <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
        <item id="chapter" href="Text/Chapter%201.XHTML" media-type="application/xhtml+xml" />
      </manifest>
      <spine><itemref idref="chapter" /></spine>
    </package>`);
  zip.file('ops/nav.xhtml', `<html><body><nav epub:type="toc"><a href="Text/Chapter%201.XHTML#start">Opening Light</a></nav></body></html>`);
  zip.file('ops/text/Chapter 1.xhtml', `<html><body><h1>Internal Heading</h1><p>A caf&eacute; stayed open after midnight.</p><p>Readers gathered around the fire.</p></body></html>`);
  zip.file('META-INF/encryption.xml', `<?xml version="1.0"?>
    <encryption><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding" />
    <CipherData><CipherReference URI="OPS/Fonts/book.otf" /></CipherData></EncryptedData></encryption>`);

  const data = await zip.generateAsync({ type: 'arraybuffer' });
  const book = await parseEpub(data, 'Fallback');
  assert.equal(book.chapters.length, 1);
  assert.equal(book.chapters[0].title, 'Opening Light');
  assert.match(book.chapters[0].paragraphs.join(' '), /café/);
}

async function verifyEpubDrmRejection() {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', `<container><rootfiles><rootfile full-path="book.opf" /></rootfiles></container>`);
  zip.file('book.opf', `<package><metadata><title>Locked</title></metadata><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml" /></manifest><spine><itemref idref="c" /></spine></package>`);
  zip.file('c.xhtml', `<html><body><p>This content should not be imported.</p></body></html>`);
  zip.file('META-INF/encryption.xml', `<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc" /><CipherData><CipherReference URI="c.xhtml" /></CipherData></EncryptedData></encryption>`);
  const data = await zip.generateAsync({ type: 'arraybuffer' });
  await assert.rejects(() => parseEpub(data, 'Locked'), /DRM/);
}

function verifyMarkupAndPdf() {
  const markup = htmlToParagraphs(`<html><head><title>Noise</title></head><body><h1>Chapter</h1><p>One&nbsp;quiet sentence.</p><script>ignore me</script></body></html>`);
  assert.equal(markup.title, 'Chapter');
  assert.doesNotMatch(markup.paragraphs.join(' '), /ignore me/);

  const pdf = parseExtractedPdfText(`1\n\nChapter 1\n\nThe obser-\nvatory remained quiet through the evening.\n\nA second paragraph carried enough English words for reliable extraction.`, 'Digital PDF');
  assert.equal(pdf.format, 'pdf');
  assert.match(pdf.chapters[0].paragraphs.join(' '), /observatory/);
  assert.throws(() => parseExtractedPdfText('1\n2\n3', 'Scan'), PdfNeedsOcrError);
  assert.equal(pdfNeedsOcr('A short metadata sentence with a handful of readable English words.', 100), true);
  assert.equal(pdfNeedsOcr(pdf.chapters[0].paragraphs.join(' '), 1), false);
  assert.equal(formatPdfExtractionError('PDF_LOAD_ERROR'), '无法读取 PDF 文件，文件可能已移动或访问权限已失效。请重新选择后重试');
  assert.equal(formatPdfExtractionError('PDF_EXTRACTION_ERROR'), '无法读取 PDF 正文。请确认文件仍可访问且未被其他应用占用，然后重试');
}

function verifyTranslationChunking() {
  const sentence = Array.from({ length: 120 }, (_, index) => `word${index}`).join(' ');
  const chunks = splitTranslationText(sentence);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(' '), sentence);
}

function verifyKindleDrmGuard() {
  const file = new ArrayBuffer(160);
  const view = new DataView(file);
  view.setUint16(76, 1, false);
  view.setUint32(78, 96, false);
  for (const [offset, value] of [[60, 'BOOK'], [64, 'MOBI'], [112, 'MOBI']] as const) {
    Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  }
  view.setUint32(132, 8, false);
  view.setUint16(108, 0, false);
  assert.doesNotThrow(() => assertDrmFreeKindleFile(file, 'azw3'));
  assert.deepEqual(inspectKindleFile(file), { isKindle: true, mobiVersion: 8, likelyKf8: true });

  view.setUint16(108, 2, false);
  assert.throws(() => assertDrmFreeKindleFile(file, 'kf8'), /DRM/);
  assert.equal(formatKindleParseFailure('kf8'), '无法解析 KF8 文件。文件可能损坏、扩展名不正确，或包含暂不支持的固定版式；请确认文件无 DRM 且为可重排文字内容后重试');
}

async function main() {
  await verifyTxt();
  await verifyEpub();
  await verifyEpubCompatibility();
  await verifyEpubDrmRejection();
  verifyMarkupAndPdf();
  verifyTranslationChunking();
  verifyKindleDrmGuard();
  console.log('✓ TXT, EPUB, Kindle DRM guard, PDF/OCR fallback detection, markup, and translation parser checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
