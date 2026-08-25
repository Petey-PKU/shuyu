import assert from 'node:assert/strict';
import test from 'node:test';
import { createTranslationGateway } from '../src/gateway.mjs';
import { createTencentHeaders } from '../src/providers.mjs';

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test('uses Azure first and caches the complete sentence', async () => {
  const calls = [];
  const gateway = createTranslationGateway({
    env: { AZURE_TRANSLATOR_KEY: 'test-key' },
    now: () => 1_700_000_000_000,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return response(200, [{ translations: [{ text: '这是一条完整长句。', to: 'zh-Hans' }] }]);
    },
  });
  const request = {
    method: 'POST',
    url: 'https://proxy.example/translate',
    headers: {},
    body: JSON.stringify({ text: 'This is a complete long sentence.', source: 'en', target: 'zh-CN' }),
    clientAddress: '127.0.0.1',
  };
  const first = await gateway(request);
  const second = await gateway(request);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { translation: '这是一条完整长句。', provider: 'azure', cached: false });
  assert.equal(second.body.cached, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api-version=3\.0/);
  assert.deepEqual(JSON.parse(calls[0].init.body), [{ Text: 'This is a complete long sentence.' }]);
  assert.equal(calls[0].init.headers['Ocp-Apim-Subscription-Key'], 'test-key');
});

test('falls back to Tencent and sends a TC3 signed request', async () => {
  const calls = [];
  const gateway = createTranslationGateway({
    env: {
      AZURE_TRANSLATOR_KEY: 'azure-test-key',
      TENCENT_SECRET_ID: 'AKIDEXAMPLE',
      TENCENT_SECRET_KEY: 'secret-example',
      TENCENT_REGION: 'ap-guangzhou',
    },
    now: () => 1_700_000_000_000,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1) return response(429, { error: { code: '429000' } });
      return response(200, { Response: { TargetText: '腾讯备用译文', RequestId: 'request-id' } });
    },
  });
  const result = await gateway({
    method: 'POST',
    url: 'https://proxy.example/translate',
    headers: {},
    body: { text: 'Fallback translation.', source: 'en', target: 'zh-Hans' },
    clientAddress: '127.0.0.2',
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { translation: '腾讯备用译文', provider: 'tencent', cached: false });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://tmt.tencentcloudapi.com');
  assert.match(calls[1].init.headers.Authorization, /^TC3-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
  assert.equal(calls[1].init.headers['X-TC-Action'], 'TextTranslate');
  assert.equal(calls[1].init.headers['X-TC-Version'], '2018-03-21');
});

test('creates deterministic Tencent signatures without exposing the secret', () => {
  const payload = JSON.stringify({ SourceText: 'hello', Source: 'en', Target: 'zh', ProjectId: 0 });
  const headers = createTencentHeaders(payload, {
    TENCENT_SECRET_ID: 'AKIDEXAMPLE',
    TENCENT_SECRET_KEY: 'secret-example',
    TENCENT_REGION: 'ap-guangzhou',
  }, 1_700_000_000);
  assert.match(headers.Authorization, /Credential=AKIDEXAMPLE\/2023-11-14\/tmt\/tc3_request/);
  assert.doesNotMatch(headers.Authorization, /secret-example/);
  assert.equal(headers['X-TC-Timestamp'], '1700000000');
});

test('rejects invalid language requests and enforces rate limits', async () => {
  let now = 1_700_000_000_000;
  const gateway = createTranslationGateway({
    env: { AZURE_TRANSLATOR_KEY: 'test-key', MAX_REQUESTS_PER_MINUTE: '5' },
    now: () => now,
    fetchImpl: async () => response(200, [{ translations: [{ text: '译文' }] }]),
  });
  const invalid = await gateway({
    method: 'POST',
    url: 'https://proxy.example/translate',
    body: { text: 'Bonjour', source: 'fr', target: 'zh-CN' },
    clientAddress: 'invalid-client',
  });
  assert.equal(invalid.status, 400);

  for (let index = 0; index < 5; index += 1) {
    const accepted = await gateway({
      method: 'POST',
      url: 'https://proxy.example/translate',
      body: { text: `Sentence ${index}.`, source: 'en', target: 'zh-CN' },
      clientAddress: 'limited-client',
    });
    assert.equal(accepted.status, 200);
  }
  const limited = await gateway({
    method: 'POST',
    url: 'https://proxy.example/translate',
    body: { text: 'One more sentence.', source: 'en', target: 'zh-CN' },
    clientAddress: 'limited-client',
  });
  assert.equal(limited.status, 429);
  now += 60_000;
  const reset = await gateway({
    method: 'POST',
    url: 'https://proxy.example/translate',
    body: { text: 'After the window.', source: 'en', target: 'zh-CN' },
    clientAddress: 'limited-client',
  });
  assert.equal(reset.status, 200);
});
