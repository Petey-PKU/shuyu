import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

// Export .cache/web-preview and serve it on port 4174 first.
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://127.0.0.1:4174';
const width = Number(process.env.IMPORT_WIDTH || 320);
const height = width <= 320 ? 568 : 844;
const fileName = 'This_is_a_very_long_book_filename_that_should_stay_identifiable_during_import_2026.txt';
const filePath = `.cache/${fileName}`;
const importerSource = readFileSync('src/services/importer.ts', 'utf8');
assert.ok(importerSource.includes('asset.file ?? result.output?.[0]'), 'Web import must retain the selected File object');
assert.ok(importerSource.includes('asset.name || webFile?.name'), 'Web import must derive the filename from the selected file');
writeFileSync(filePath, `A short imported chapter for ${fileName}.\n`);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport: { width, height } });
const runtimeErrors = [];
const externalRequests = [];
await context.route('**/*', async (route) => {
  if (new URL(route.request().url()).origin === origin) await route.continue();
  else { externalRequests.push(route.request().url()); await route.abort(); }
});
const page = await context.newPage();
page.setDefaultTimeout(8000);
page.on('pageerror', (error) => runtimeErrors.push(error.message));
try {
  await page.goto(origin);
  await page.getByRole('button', { name: '导入电子书', exact: true }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await page.getByText('正在解析章节', { exact: true }).waitFor();
  const cancelButton = page.getByRole('button', { name: '取消电子书导入', exact: true });
  const cancelBox = await cancelButton.boundingBox();
  assert.ok(cancelBox && cancelBox.y >= 0 && cancelBox.y + cancelBox.height <= height, 'Import progress must keep the cancel action in view');
  assert.deepEqual(runtimeErrors, [], 'Import progress must not produce browser runtime errors');
  assert.deepEqual(externalRequests, [], 'Import progress must stay offline');
  console.log(`Import progress passed at ${width}x${height}: filename source contract, cancel action, and offline requests.`);
} finally {
  await browser.close();
  try { unlinkSync(filePath); } catch {}
}
