import { createHash, createHmac, randomUUID } from 'node:crypto';

const AZURE_GLOBAL_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';
const TENCENT_HOST = 'tmt.tencentcloudapi.com';
const TENCENT_SERVICE = 'tmt';
const TENCENT_ACTION = 'TextTranslate';
const TENCENT_VERSION = '2018-03-21';
const CONTENT_TYPE = 'application/json; charset=utf-8';

export class TranslationProviderError extends Error {
  constructor(provider, code, status) {
    super(`${provider} translation failed (${code})`);
    this.name = 'TranslationProviderError';
    this.provider = provider;
    this.code = code;
    this.status = status;
  }
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function integerSetting(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

async function fetchJson(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    let data;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error?.name === 'AbortError') return { ok: false, status: 504, data: undefined };
    return { ok: false, status: 502, data: undefined };
  } finally {
    clearTimeout(timeout);
  }
}

function azureTranslateUrl(endpoint) {
  const normalized = (endpoint || AZURE_GLOBAL_ENDPOINT).replace(/\/+$/, '');
  const url = new URL(normalized.endsWith('/translate') ? normalized : `${normalized}/translate`);
  url.searchParams.set('api-version', '3.0');
  url.searchParams.set('from', 'en');
  url.searchParams.set('to', 'zh-Hans');
  if (url.protocol !== 'https:') throw new Error('Azure Translator endpoint must use HTTPS');
  return url;
}

export function configuredProviders(env) {
  const providers = [];
  if (env.AZURE_TRANSLATOR_KEY?.trim()) providers.push('azure');
  if (env.TENCENT_SECRET_ID?.trim() && env.TENCENT_SECRET_KEY?.trim()) providers.push('tencent');
  return providers;
}

export async function translateWithAzure(text, env, options = {}) {
  const key = env.AZURE_TRANSLATOR_KEY?.trim();
  if (!key) throw new TranslationProviderError('azure', 'NOT_CONFIGURED', 503);
  const headers = {
    'Content-Type': CONTENT_TYPE,
    'Ocp-Apim-Subscription-Key': key,
    'X-ClientTraceId': randomUUID(),
  };
  const region = env.AZURE_TRANSLATOR_REGION?.trim();
  if (region) headers['Ocp-Apim-Subscription-Region'] = region;
  const timeoutMs = integerSetting(env.PROVIDER_TIMEOUT_MS, 7_000, 1_000, 15_000);
  const result = await fetchJson(
    options.fetchImpl ?? fetch,
    azureTranslateUrl(env.AZURE_TRANSLATOR_ENDPOINT?.trim()),
    { method: 'POST', headers, body: JSON.stringify([{ Text: text }]) },
    timeoutMs,
  );
  const translation = result.data?.[0]?.translations?.[0]?.text?.trim();
  if (!result.ok || !translation) {
    const code = result.data?.error?.code || `HTTP_${result.status}`;
    throw new TranslationProviderError('azure', code, result.status);
  }
  return translation;
}

export function createTencentHeaders(payload, env, timestamp = Math.floor(Date.now() / 1000)) {
  const secretId = env.TENCENT_SECRET_ID?.trim();
  const secretKey = env.TENCENT_SECRET_KEY?.trim();
  if (!secretId || !secretKey) throw new TranslationProviderError('tencent', 'NOT_CONFIGURED', 503);

  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = `content-type:${CONTENT_TYPE}\nhost:${TENCENT_HOST}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${TENCENT_SERVICE}/tc3_request`;
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, TENCENT_SERVICE);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign, 'hex');
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers = {
    Authorization: authorization,
    'Content-Type': CONTENT_TYPE,
    Host: TENCENT_HOST,
    'X-TC-Action': TENCENT_ACTION,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': TENCENT_VERSION,
    'X-TC-Region': env.TENCENT_REGION?.trim() || 'ap-guangzhou',
  };
  const token = env.TENCENT_SESSION_TOKEN?.trim();
  if (token) headers['X-TC-Token'] = token;
  return headers;
}

export async function translateWithTencent(text, env, options = {}) {
  // Tencent TMT's text endpoint has a lower per-request limit than Azure.
  // Very long inputs remain eligible for Azure and the client's final fallback.
  if (text.length > 2_000) throw new TranslationProviderError('tencent', 'TEXT_TOO_LONG', 413);
  const payload = JSON.stringify({
    SourceText: text,
    Source: 'en',
    Target: 'zh',
    ProjectId: 0,
  });
  const timestamp = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const timeoutMs = integerSetting(env.PROVIDER_TIMEOUT_MS, 7_000, 1_000, 15_000);
  const result = await fetchJson(
    options.fetchImpl ?? fetch,
    `https://${TENCENT_HOST}`,
    { method: 'POST', headers: createTencentHeaders(payload, env, timestamp), body: payload },
    timeoutMs,
  );
  const translation = result.data?.Response?.TargetText?.trim();
  if (!result.ok || !translation || result.data?.Response?.Error) {
    const code = result.data?.Response?.Error?.Code || `HTTP_${result.status}`;
    throw new TranslationProviderError('tencent', code, result.status);
  }
  return translation;
}

export async function translateWithConfiguredProviders(text, env, options = {}) {
  const configured = new Set(configuredProviders(env));
  const requestedOrder = (env.TRANSLATION_PROVIDER_ORDER || 'azure,tencent')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value === 'azure' || value === 'tencent');
  const order = requestedOrder.length ? [...new Set(requestedOrder)] : ['azure', 'tencent'];
  if (!configured.size) throw new TranslationProviderError('gateway', 'NO_PROVIDER_CONFIGURED', 503);

  let lastError;
  for (const provider of order) {
    if (!configured.has(provider)) continue;
    try {
      const translation = provider === 'azure'
        ? await translateWithAzure(text, env, options)
        : await translateWithTencent(text, env, options);
      return { translation, provider };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new TranslationProviderError('gateway', 'NO_AVAILABLE_PROVIDER', 503);
}
