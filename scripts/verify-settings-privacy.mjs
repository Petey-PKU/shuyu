import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// Export .cache/web-preview and serve it on 127.0.0.1:4174 first.
const { chromium } = createRequire(import.meta.url)('playwright');
const origin = 'http://127.0.0.1:4174';
const width = Number(process.env.SETTINGS_WIDTH || 320);
const height = width <= 320 ? 568 : 844;
const appVersion = JSON.parse(readFileSync('app.json', 'utf8')).expo.version;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport: { width, height } });
const runtimeErrors = [];
const externalRequests = [];
await context.route('**/*', async (route) => {
  if (new URL(route.request().url()).origin === origin) await route.continue();
  else { externalRequests.push(route.request().url()); await route.abort(); }
});
const page = await context.newPage();
page.on('pageerror', (error) => runtimeErrors.push(error.message));
try {
  await page.goto(origin);
  await page.getByRole('tab', { name: /设置/ }).click();
  await page.getByRole('button', { name: '隐私说明', exact: true }).click();
  const privacyTitle = page.getByRole('heading', { name: '隐私说明', exact: true });
  await privacyTitle.waitFor();
  const initialBox = await privacyTitle.boundingBox();
  assert.ok(initialBox && initialBox.y >= 0, 'Privacy title must remain visible on a narrow screen');
  const closePrivacy = page.getByRole('button', { name: '关闭隐私说明', exact: true });
  await closePrivacy.scrollIntoViewIfNeeded();
  const closeBox = await closePrivacy.boundingBox();
  assert.ok(closeBox && closeBox.y >= 0 && closeBox.y + closeBox.height <= height, 'The full privacy notice must scroll to an in-viewport close action');
  await closePrivacy.click();

  await page.getByRole('switch', { name: '在线翻译增强' }).click();
  await page.getByRole('button', { name: '确认开启在线翻译增强', exact: true }).waitFor();
  const onlineCancel = page.getByRole('button', { name: '暂不开启在线翻译增强', exact: true });
  assert.ok((await onlineCancel.boundingBox())?.y >= 0, 'Online translation confirmation must stay reachable');
  await onlineCancel.click();
  await page.getByRole('button', { name: '确认开启在线翻译增强', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: '确认开启在线翻译增强', exact: true }).count(), 0, 'Declining online enhancement keeps the prompt closed');
  assert.equal(await page.getByRole('switch', { name: '在线翻译增强' }).isChecked(), false, 'Declining keeps online enhancement disabled');
  await page.getByRole('button', { name: '关于书语', exact: true }).click();
  await page.getByRole('heading', { name: '关于书语', exact: true }).waitFor();
  assert.equal(await page.getByText(`版本 ${appVersion} · GPL-3.0-only`, { exact: true }).count(), 1, 'About dialog must use the configured app version');
  await page.getByRole('button', { name: '关闭关于书语', exact: true }).click();
  await page.getByRole('heading', { name: '关于书语', exact: true }).waitFor({ state: 'hidden' });
  assert.deepEqual(runtimeErrors, [], 'Privacy settings flow must not produce browser runtime errors');
  assert.deepEqual(externalRequests, [], 'Privacy settings flow must not request external services');
  console.log(`Settings privacy passed at ${width}x${height}: scrollable privacy notice, online consent, decline state, and offline requests.`);
} finally {
  await browser.close();
}
