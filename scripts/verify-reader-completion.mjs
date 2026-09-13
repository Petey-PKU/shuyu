import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Export .cache/web-preview and serve it at 127.0.0.1:4174 before running.
// Each context seeds only synthetic local data and blocks external requests.
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://127.0.0.1:4174';
const artifacts = resolve('.cache/reader-completion-check');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });

async function fixture({ width = 390, multiChapter = false, emptyEnding = false, longChapter = false, failSave = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 } });
  const errors = [];
  const requests = [];
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { requests.push(route.request().url()); await route.abort(); }
  });
  await context.addInitScript(({ multiChapter, emptyEnding, longChapter, failSave }) => {
    const id = 'completion_fixture';
    if (!sessionStorage.getItem('completion-seeded')) {
      const now = new Date().toISOString();
      const chapters = [{ id: 'first', title: 'A short story', paragraphs: ['A quiet room makes space for a new story.'], wordCount: 10 }];
      if (longChapter) {
        chapters[0].paragraphs = Array.from({ length: 20 }, () => chapters[0].paragraphs[0]);
        chapters[0].wordCount = 200;
      }
      if (multiChapter) chapters.push({ id: 'last', title: 'The ending', paragraphs: emptyEnding ? [] : ['Tomorrow will bring another good story.'], wordCount: emptyEnding ? 0 : 6 });
      const book = { id, title: '短书完成测试', author: '本地测试数据', format: 'txt', createdAt: now, lastOpenedAt: now,
        currentChapter: 0, currentParagraph: 0, progress: 0, chapterCount: chapters.length,
        totalWords: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0), accent: '#826E54' };
      const entries = {
        '@shuyu/books': [book], '@shuyu/words': [],
        '@shuyu/stats': { minutes: 0, words: 0, todayMinutes: 0, todayWords: 0, streak: 0 },
        '@shuyu/preferences': { fontSize: 19, lineHeight: 32, dailyGoalMinutes: 15, theme: 'paper', onlineSentenceTranslation: false },
        '@shuyu/recommendations': { preferredGenres: [], savedBookIds: [], feedback: {} },
        '@shuyu/reading-signals': [],
        ['@shuyu/content/' + id]: { id, title: book.title, chapters },
      };
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('@shuyu/sample-seeded', 'true');
      localStorage.setItem('@shuyu/reader-tap-hint-seen', 'true');
      sessionStorage.setItem('completion-seeded', 'true');
    }
    window.failCompletionWrite = failSave;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === '@shuyu/books' && window.failCompletionWrite
        && JSON.parse(value).some((book) => book.progress === 1)) throw new Error('测试存储空间不足');
      return originalSet.call(this, key, value);
    };
  }, { multiChapter, emptyEnding, longChapter, failSave });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: '开始阅读：短书完成测试', exact: true }).click();
  await page.getByRole('button', { name: '查词：quiet', exact: true }).first().waitFor();
  return { page, context, verify: () => { assert.deepEqual(errors, []); assert.deepEqual(requests, []); } };
}

const readProgress = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('@shuyu/books'))[0].progress);
const waitProgress = (page, value) => page.waitForFunction((expected) => JSON.parse(localStorage.getItem('@shuyu/books'))[0].progress === expected, value);
const heading = (page) => page.getByRole('heading', { name: '这本书读完了', exact: true });

try {
  for (const width of [390, 320]) {
    const { page, context, verify } = await fixture({ width });
    await page.getByRole('button', { name: '读完这本书', exact: true }).waitFor();
    assert.equal(await heading(page).count(), 0, 'Opening a short book must leave its text visible');
    assert.equal(await readProgress(page), 0, 'The first page starts at 0% until the reader finishes');
    await page.screenshot({ path: resolve(artifacts, `short-book-${width}.png`) });
    await page.getByRole('button', { name: '读完这本书', exact: true }).click();
    await heading(page).waitFor();
    await waitProgress(page, 1);
    await page.getByRole('button', { name: '继续查看书页', exact: true }).click();
    await heading(page).waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: width === 320 ? 390 : 320, height: 568 });
    await page.getByRole('button', { name: '读完这本书', exact: true }).waitFor();
    assert.equal(await heading(page).count(), 0, 'Reflow must not reopen the completion dialog');
    assert.equal(await readProgress(page), 1, 'Reflow must preserve confirmed completion');
    await page.reload();
    await page.getByRole('tab', { name: /书架/ }).click();
    await page.getByRole('button', { name: '打开《短书完成测试》', exact: true }).click();
    await page.getByRole('button', { name: '读完这本书', exact: true }).waitFor();
    assert.equal(await heading(page).count(), 0, 'Reopening a completed book must not cover its text');
    assert.equal(await readProgress(page), 1, 'Reload retains completed status');
    await page.getByRole('button', { name: '读完这本书', exact: true }).click();
    await page.getByRole('button', { name: '从头再读一遍', exact: true }).click();
    await heading(page).waitFor({ state: 'hidden' });
    await waitProgress(page, 0);
    assert.equal(await heading(page).count(), 0, 'Restarting a single-page book must remain at the text');
    await page.getByRole('button', { name: '读完这本书', exact: true }).click();
    await waitProgress(page, 1);
    await page.getByRole('button', { name: '返回书架', exact: true }).click();
    await page.getByRole('tab', { name: /今天/ }).click();
    await page.getByRole('button', { name: '重读：短书完成测试', exact: true }).click();
    await waitProgress(page, 0);
    assert.equal(await heading(page).count(), 0, 'Home replay must not immediately complete a short book');
    verify();
    await context.close();
  }

  for (const emptyEnding of [false, true]) {
    const { page, context, verify } = await fixture({ multiChapter: true, emptyEnding });
    assert.equal(await page.getByRole('button', { name: '读完这本书', exact: true }).count(), 0);
    await page.getByRole('button', { name: '下一章', exact: true }).click();
    await page.getByRole('button', { name: '读完这本书', exact: true }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('@shuyu/books'))[0].currentChapter === 1);
    assert.equal(await heading(page).count(), 0, 'Reaching the final chapter must not interrupt reading');
    const progress = await readProgress(page);
    assert.ok(progress > 0 && progress < 1, 'An unconfirmed last page, including a blank ending, stays below 100%');
    await page.getByRole('button', { name: '读完这本书', exact: true }).click();
    await waitProgress(page, 1);
    verify();
    await context.close();
  }

  {
    const { page, context, verify } = await fixture({ longChapter: true });
    const finish = page.getByRole('button', { name: '读完这本书', exact: true });
    let turns = 0;
    while (!await finish.count() && turns < 20) {
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('@shuyu/books'))[0].currentOffset ?? 0);
      await page.getByRole('button', { name: '下一页', exact: true }).click();
      await page.waitForFunction((offset) => JSON.parse(localStorage.getItem('@shuyu/books'))[0].currentOffset > offset, before);
      turns += 1;
    }
    assert.ok(turns > 0 && turns < 20, 'The long fixture must span multiple pages and reach its ending');
    await finish.waitFor();
    assert.equal(await heading(page).count(), 0, 'Turning onto the final page must not cover the ending');
    assert.ok(await readProgress(page) < 1);
    await finish.click();
    await waitProgress(page, 1);
    verify();
    await context.close();
  }

  const { page, context, verify } = await fixture({ width: 320, failSave: true });
  await page.getByRole('button', { name: '读完这本书', exact: true }).click();
  const card = heading(page).locator('..');
  await card.getByText('读完状态已在当前会话更新，但设备尚未保存。', { exact: true }).waitFor();
  assert.equal(await readProgress(page), 0, 'A rejected save must not be mistaken for persisted completion');
  const retry = card.getByRole('button', { name: '重试保存', exact: true });
  const retryBox = await retry.boundingBox();
  assert.ok(retryBox && retryBox.y >= 0 && retryBox.y + retryBox.height <= 568, 'Save recovery must fit the narrow screen');
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))));
  await page.screenshot({ path: resolve(artifacts, 'completion-save-retry-320.png') });
  await page.evaluate(() => { window.failCompletionWrite = false; });
  await retry.click();
  await waitProgress(page, 1);
  await retry.waitFor({ state: 'hidden' });
  verify();
  await context.close();
  console.log('Reader completion passed: one-page first use, two widths, explicit finish, reload, reflow, restart, Home replay, multi-page endings, final/empty chapters, and save recovery.');
} finally {
  await browser.close();
}
