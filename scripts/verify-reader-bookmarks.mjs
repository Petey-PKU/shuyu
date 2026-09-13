import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Uses an optional local Playwright installation (or NODE_PATH to a bundled one).
// First export to .cache/web-preview, run prepare-reader-preview.mjs, and serve
// that directory at 127.0.0.1:4174. A fresh browser context contains only fixtures.
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://127.0.0.1:4174';
const artifacts = resolve('.cache/reader-bookmark-check');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const unexpectedRequests = [];
  const runtimeErrors = [];
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { unexpectedRequests.push(route.request().url()); await route.abort(); }
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto(`${origin}/reader-recovery-test.html?case=cross-book`);
  await page.getByRole('tab', { name: /书架/ }).click();
  await page.getByRole('button', { name: '打开《相同原句的第二本书》', exact: true }).click();
  await page.getByRole('button', { name: '查词：quiet', exact: true }).click();
  await page.getByText('词典释义', { exact: true }).waitFor();
  const bookmark = page.getByRole('button', { name: /^(收藏到生词本|已收藏到生词本)$/ });
  await bookmark.waitFor();
  await page.screenshot({ path: resolve(artifacts, 'second-book-before-save.png') });
  assert.equal(await bookmark.isEnabled(), true,
    'The same word and sentence saved in the first book must not disable saving in the second book');
  await bookmark.click();
  await page.getByText('已加入生词本', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '已收藏到生词本', exact: true }).isDisabled(), true,
    'After saving, repeated clicks in the same book must be disabled');

  // Load the normal entry without the fixture seeding script to verify persistence.
  await page.goto(`${origin}/index.html`);
  await page.getByRole('tab', { name: /生词/ }).click();
  await page.getByText('2 个收藏词', { exact: true }).waitFor();
  const firstSource = page.getByRole('button', { name: /回到阅读恢复测试.*quiet所在原文/ });
  const secondSource = page.getByRole('button', { name: /回到相同原句的第二本书.*quiet所在原文/ });
  assert.equal(await firstSource.count(), 1, 'The first source survives saving the second');
  assert.equal(await secondSource.count(), 1, 'The second source survives a fresh app load');
  await page.screenshot({ path: resolve(artifacts, 'two-book-sources.png') });
  await secondSource.click();
  await page.getByRole('button', { name: '查词：quiet', exact: true }).click();
  await page.getByText('词典释义', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '已收藏到生词本', exact: true }).isDisabled(), true,
    'Reopening the saved source must retain its bookmarked state');
  assert.deepEqual(runtimeErrors, [], 'The full flow must not produce browser runtime errors');
  assert.deepEqual(unexpectedRequests, [], 'Offline word saving must not request external services');
  console.log('Reader bookmarks passed: cross-book saving, same-book duplicate guard, reload persistence, source navigation, and offline requests.');
} finally {
  await browser.close();
}
