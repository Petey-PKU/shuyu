import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Export .cache/web-preview and serve it on port 4174 first.
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://127.0.0.1:4174';
const wordsKey = '@shuyu/words';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const runtimeErrors = [];
const externalRequests = [];

await context.route('**/*', async (route) => {
  if (new URL(route.request().url()).origin === origin) await route.continue();
  else { externalRequests.push(route.request().url()); await route.abort(); }
});
await context.addInitScript((key) => {
  window.__reviewFault = false;
  const originalSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
    if (window.__reviewFault && name === key) throw new DOMException('Simulated storage failure', 'QuotaExceededError');
    return originalSet.call(this, name, value);
  };
}, wordsKey);

const page = await context.newPage();
page.setDefaultTimeout(8000);
page.on('pageerror', (error) => runtimeErrors.push(error.message));
try {
  await page.goto(origin);
  await page.getByText('下午好', { exact: true }).waitFor();
  const bookId = await page.evaluate(() => JSON.parse(localStorage.getItem('@shuyu/books'))[0].id);
  await page.evaluate(({ bookId, wordsKey }) => {
    localStorage.setItem(wordsKey, JSON.stringify([{
      id: 'review-recovery-test', word: 'quiet', meaning: '安静的', context: 'It was quiet.',
      bookId, bookTitle: 'The Quiet Observatory', chapterIndex: 0, paragraphIndex: 0,
      createdAt: new Date(Date.now() - 86_400_000).toISOString(), mastered: false,
      reviewCount: 0, nextReviewAt: new Date(Date.now() - 1_000).toISOString(),
    }]));
  }, { bookId, wordsKey });
  await page.reload();
  await page.getByRole('button', { name: /开始复习，1 个词今天到期/ }).first().click();
  await page.getByRole('button', { name: '查看答案', exact: true }).click();
  await page.evaluate(() => { window.__reviewFault = true; });
  await page.getByRole('button', { name: '标记为已掌握', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '结果已保留' }).waitFor();
  await page.getByRole('button', { name: '退出复习，结果尚未保存', exact: true }).click();
  await page.getByRole('button', { name: '稍后处理并退出复习', exact: true }).click();
  await page.getByText('今日节奏', { exact: true }).waitFor();
  await page.getByRole('alert').filter({ hasText: '本地数据需要重试' }).waitFor();
  await page.evaluate(() => { window.__reviewFault = false; });
  await page.getByRole('button', { name: '重试保存本地数据', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '本地数据需要重试' }).waitFor({ state: 'hidden' });
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key))[0], wordsKey);
  assert.equal(saved.mastered, true, 'The deferred review result is eventually persisted');
  assert.equal(await page.getByRole('alert').filter({ hasText: '本地数据需要重试' }).count(), 0);
  assert.deepEqual(runtimeErrors, [], 'Review recovery has no runtime errors');
  assert.deepEqual(externalRequests, [], 'Review recovery stays offline');
  console.log('Review recovery passed: failed result warning, system-exit confirmation, global retry, and persistence.');
} finally {
  await browser.close();
}
