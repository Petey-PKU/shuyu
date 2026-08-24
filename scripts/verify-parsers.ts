import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseEpub } from '../src/services/epub';
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
}

async function main() {
  await verifyTxt();
  await verifyEpub();
  console.log('✓ TXT and EPUB parser checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
