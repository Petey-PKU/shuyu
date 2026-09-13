import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessmentQuestions } from '../src/data/assessment.ts';

// Export .cache/web-preview and serve it on port 4174 first. Run through
// scripts/run-verifier.mjs to load the TypeScript question fixtures.
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://127.0.0.1:4174';
const draftKey = '@shuyu/assessment-draft';
const profileKey = '@shuyu/recommendations';
const artifacts = resolve('.cache/assessment-recovery-check');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const failures = [];

async function scenario(name, run) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const runtimeErrors = [];
  const externalRequests = [];
  await context.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { externalRequests.push(route.request().url()); await route.abort(); }
  });
  await context.addInitScript(({ draftKey, profileKey, total }) => {
    window.__assessmentFaults = { profile: false, draft: false, finalDraft: false, clear: false };
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const faults = window.__assessmentFaults;
      if ((faults.profile && key === profileKey && JSON.parse(value).profile)
        || (faults.draft && key === draftKey)
        || (faults.finalDraft && key === draftKey && Object.keys(JSON.parse(value)).length === total)) {
        throw new DOMException('Simulated device storage failure', 'QuotaExceededError');
      }
      return originalSet.call(this, key, value);
    };
    const originalRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (window.__assessmentFaults.clear && key === draftKey) {
        throw new DOMException('Simulated device storage failure', 'InvalidStateError');
      }
      return originalRemove.call(this, key);
    };
  }, { draftKey, profileKey, total: assessmentQuestions.length });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  try {
    await page.goto(origin);
    await page.getByRole('tab', { name: /发现/ }).click();
    await page.getByRole('button', { name: '开始水平测试', exact: true }).click();
    await run(page);
    assert.deepEqual(runtimeErrors, [], 'No unhandled browser errors');
    assert.deepEqual(externalRequests, [], 'Assessment answers stay offline');
    console.log(`PASS ${name}`);
  } catch (error) {
    await page.screenshot({ path: resolve(artifacts, `${name.replace(/\W+/g, '-')}.png`) }).catch(() => undefined);
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    await context.close();
  }
}

async function answerAll(page) {
  for (const [index, question] of assessmentQuestions.entries()) {
    await page.getByText(`${index + 1}/${assessmentQuestions.length}`, { exact: true }).waitFor();
    const answer = question.correctIndex;
    await page.getByRole('button', {
      name: `选择答案 ${String.fromCharCode(65 + answer)}：${question.options[answer]}`, exact: true,
    }).click();
  }
  await page.getByRole('button', { name: '查看我的推荐', exact: true }).waitFor();
}

async function answerFirst(page) {
  const first = assessmentQuestions[0];
  await page.getByRole('button', { name: `选择答案 A：${first.options[0]}`, exact: true }).click();
  await page.getByText(`2/${assessmentQuestions.length}`, { exact: true }).waitFor();
}

async function stored(page) {
  return page.evaluate(({ draftKey, profileKey }) => ({
    draft: JSON.parse(localStorage.getItem(draftKey)),
    profile: JSON.parse(localStorage.getItem(profileKey))?.profile ?? null,
  }), { draftKey, profileKey });
}

async function retryResult(page) {
  await page.evaluate(() => { window.__assessmentFaults.profile = false; });
  const notice = page.getByRole('alert').filter({ hasText: '等级结果已在当前会话生效' });
  await notice.getByRole('button', { name: '重试保存', exact: true }).click();
  await notice.waitFor({ state: 'hidden' });
  const state = await stored(page);
  assert.equal(state.profile?.level, 'C2', 'Retry persists the displayed level');
  assert.equal(state.draft, null, 'Successful retry removes the completed draft');
}

try {
  await scenario('normal completion and fresh restart', async (page) => {
    await answerAll(page);
    const state = await stored(page);
    assert.equal(state.profile?.level, 'C2');
    assert.equal(state.draft, null);
    await page.getByRole('button', { name: '重新测试', exact: true }).click();
    await page.getByText(`1/${assessmentQuestions.length}`, { exact: true }).waitFor();
  });

  await scenario('profile failure then retry clears the complete draft', async (page) => {
    await page.evaluate(() => { window.__assessmentFaults.profile = true; });
    await answerAll(page);
    const state = await stored(page);
    assert.equal(Object.keys(state.draft).length, assessmentQuestions.length);
    assert.equal(state.profile, null);
    await retryResult(page);
    await page.getByRole('button', { name: '查看我的推荐', exact: true }).click();
    await page.getByRole('button', { name: '重新测试阅读等级', exact: true }).click();
    await page.getByText(`1/${assessmentQuestions.length}`, { exact: true }).waitFor();
  });

  await scenario('final draft and profile both fail without promising full recovery', async (page) => {
    await page.evaluate(() => { window.__assessmentFaults = { profile: true, finalDraft: true }; });
    await answerAll(page);
    const state = await stored(page);
    assert.equal(Object.keys(state.draft).length, assessmentQuestions.length - 1);
    assert.equal(state.profile, null);
    const message = await page.getByRole('alert').filter({ hasText: '等级结果已在当前会话生效' }).innerText();
    assert.ok(message.includes('未能完整保存'), 'Warn that the latest answer was not saved');
    assert.ok(!message.includes('完整测试草稿仍会保留'), 'Do not promise a recoverable complete draft');
    await retryResult(page);
  });

  await scenario('restart of app recovers the completed draft and persists its result', async (page) => {
    await page.evaluate(() => { window.__assessmentFaults.profile = true; });
    await answerAll(page);
    assert.equal((await stored(page)).profile, null);
    // Reload resets only injected faults. App storage survives unchanged.
    await page.reload();
    await page.getByRole('tab', { name: /发现/ }).click();
    await page.getByRole('button', { name: '继续水平测试', exact: true }).click();
    await page.getByRole('button', { name: '查看我的推荐', exact: true }).waitFor();
    const state = await stored(page);
    assert.equal(state.profile?.level, 'C2');
    assert.equal(state.draft, null);
  });

  await scenario('dismissed draft error still warns on exit and draft retry recovers progress', async (page) => {
    await page.evaluate(() => { window.__assessmentFaults.draft = true; });
    await answerFirst(page);
    assert.equal((await stored(page)).draft, null);
    const notice = page.getByRole('alert').filter({ hasText: '无法保存测试进度' });
    await notice.getByRole('button', { name: '关闭提示', exact: true }).click();
    await page.getByRole('button', { name: '退出测试', exact: true }).click();
    await page.getByText(/最近的作答还没有成功保存到本机/).waitFor();
    await page.getByRole('button', { name: '继续当前测试', exact: true }).click();
    // Another answer reopens the notice. Retrying must save both answers.
    const second = assessmentQuestions[1];
    await page.getByRole('button', { name: `选择答案 B：${second.options[1]}`, exact: true }).click();
    await page.getByText(`3/${assessmentQuestions.length}`, { exact: true }).waitFor();
    await page.evaluate(() => { window.__assessmentFaults.draft = false; });
    await notice.getByRole('button', { name: '重试保存', exact: true }).click();
    await notice.waitFor({ state: 'hidden' });
    assert.equal(Object.keys((await stored(page)).draft).length, 2);
    await page.reload();
    await page.getByRole('tab', { name: /发现/ }).click();
    await page.getByRole('button', { name: '继续水平测试', exact: true }).click();
    await page.getByText(`3/${assessmentQuestions.length}`, { exact: true }).waitFor();
  });

  await scenario('failed restart retains the old result until draft removal succeeds', async (page) => {
    await page.evaluate(() => { window.__assessmentFaults.profile = true; });
    await answerAll(page);
    await page.evaluate(() => { window.__assessmentFaults.clear = true; });
    await page.getByRole('button', { name: '重新测试', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '无法清除上次测试草稿' }).waitFor();
    await page.screenshot({ path: resolve(artifacts, 'result-storage-failure.png') });
    assert.equal(Object.keys((await stored(page)).draft).length, assessmentQuestions.length);
    assert.equal(await page.getByRole('button', { name: '查看我的推荐', exact: true }).isVisible(), true);
    await page.evaluate(() => { window.__assessmentFaults.clear = false; });
    await page.getByRole('button', { name: '重新测试', exact: true }).click();
    await page.getByText(`1/${assessmentQuestions.length}`, { exact: true }).waitFor();
    assert.equal((await stored(page)).draft, null);
    assert.equal(await page.getByRole('alert').filter({ hasText: '等级结果已在当前会话生效' }).count(), 0);
  });

  await scenario('failed discard keeps answers and successful discard starts fresh', async (page) => {
    await answerFirst(page);
    await page.evaluate(() => { window.__assessmentFaults.clear = true; });
    await page.getByRole('button', { name: '退出测试', exact: true }).click();
    await page.getByRole('button', { name: '退出并放弃当前测试', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '作答仍保留' }).waitFor();
    assert.equal(Object.keys((await stored(page)).draft).length, 1);
    await page.evaluate(() => { window.__assessmentFaults.clear = false; });
    await page.getByRole('button', { name: '退出测试', exact: true }).click();
    await page.getByRole('button', { name: '退出并放弃当前测试', exact: true }).click();
    // Stack navigation returns to the tab that launched the test; make the
    // destination explicit before asserting its first-use CTA.
    await page.getByRole('tab', { name: /发现/ }).click();
    await page.getByRole('button', { name: '开始水平测试', exact: true }).waitFor();
    assert.equal((await stored(page)).draft, null);
    await page.getByRole('button', { name: '开始水平测试', exact: true }).click();
    await page.getByText(`1/${assessmentQuestions.length}`, { exact: true }).waitFor();
  });

  await scenario('small screen supports the global retry and fresh retest', async (page) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => { window.__assessmentFaults.profile = true; });
    await answerAll(page);
    const notice = page.getByRole('alert').filter({ hasText: '等级结果已在当前会话生效' });
    // Dismissing the local notice must not lose cleanup after the global retry.
    await notice.getByRole('button', { name: '关闭提示', exact: true }).click();
    await page.evaluate(() => { window.__assessmentFaults.profile = false; });
    await page.getByRole('button', { name: '重试保存本地数据', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '本地数据需要重试' }).waitFor({ state: 'hidden' });
    await page.waitForFunction((key) => localStorage.getItem(key) === null, draftKey);
    assert.equal((await stored(page)).profile?.level, 'C2');
    await page.getByRole('button', { name: '查看我的推荐', exact: true }).click();
    await page.getByRole('button', { name: '重新测试阅读等级', exact: true }).click();
    await page.getByText(`1/${assessmentQuestions.length}`, { exact: true }).waitFor();
  });
} finally {
  await browser.close();
}
assert.deepEqual(failures, [], 'Assessment persistence regressions');
