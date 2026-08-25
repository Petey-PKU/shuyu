import { createHash } from 'node:crypto';
import { configuredProviders, translateWithConfiguredProviders } from './providers.mjs';

function integerSetting(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizedHeaders(headers = {}) {
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    result[name.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value ?? '');
  }
  return result;
}

function corsHeaders(headers, env) {
  const configuredOrigin = env.SHUYU_ALLOWED_ORIGIN?.trim() || '*';
  const requestOrigin = headers.origin;
  const allowedOrigin = configuredOrigin === '*' || !requestOrigin || requestOrigin === configuredOrigin
    ? configuredOrigin
    : 'null';
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function json(status, body, headers) {
  return { status, headers, body };
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cacheKey(text) {
  return createHash('sha256').update(`en\0zh-Hans\0${text}`, 'utf8').digest('hex');
}

export function createTranslationGateway(options = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map();
  const rateLimits = new Map();
  const maxTextCharacters = integerSetting(env.MAX_TEXT_CHARACTERS, 4_000, 100, 10_000);
  const maxRequestsPerMinute = integerSetting(env.MAX_REQUESTS_PER_MINUTE, 60, 5, 600);
  const cacheTtlMs = integerSetting(env.CACHE_TTL_SECONDS, 86_400, 60, 604_800) * 1_000;
  const maxCacheEntries = integerSetting(env.MAX_CACHE_ENTRIES, 1_000, 10, 10_000);

  function consumeRateLimit(clientAddress) {
    const key = String(clientAddress || 'unknown').slice(0, 128);
    const currentTime = now();
    const current = rateLimits.get(key);
    if (!current || currentTime - current.startedAt >= 60_000) {
      if (!current && rateLimits.size >= 10_000) {
        for (const [address, state] of rateLimits) {
          if (currentTime - state.startedAt >= 60_000) rateLimits.delete(address);
        }
        while (rateLimits.size >= 10_000) {
          const oldest = rateLimits.keys().next().value;
          if (!oldest) break;
          rateLimits.delete(oldest);
        }
      }
      rateLimits.set(key, { startedAt: currentTime, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= maxRequestsPerMinute;
  }

  function readCache(key) {
    const current = cache.get(key);
    if (!current) return undefined;
    if (now() - current.createdAt >= cacheTtlMs) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, current);
    return current.value;
  }

  function writeCache(key, value) {
    cache.delete(key);
    cache.set(key, { createdAt: now(), value });
    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  return async function handleRequest(request) {
    const method = String(request.method || 'GET').toUpperCase();
    const path = new URL(request.url || 'http://localhost/').pathname;
    const headers = normalizedHeaders(request.headers);
    const responseHeaders = corsHeaders(headers, env);

    if (method === 'OPTIONS') return json(204, undefined, responseHeaders);
    if (method === 'GET' && path === '/health') {
      return json(200, { ok: true, providers: configuredProviders(env) }, responseHeaders);
    }
    if (method !== 'POST' || path !== '/translate') {
      return json(404, { error: 'NOT_FOUND' }, responseHeaders);
    }
    if (!consumeRateLimit(request.clientAddress)) {
      return json(429, { error: 'RATE_LIMITED' }, { ...responseHeaders, 'Retry-After': '60' });
    }

    let body;
    try {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    } catch {
      return json(400, { error: 'INVALID_JSON' }, responseHeaders);
    }
    const text = normalizeText(body?.text);
    const source = body?.source || 'en';
    const target = body?.target || 'zh-CN';
    if (!text || source !== 'en' || !['zh', 'zh-CN', 'zh-Hans'].includes(target)) {
      return json(400, { error: 'INVALID_TRANSLATION_REQUEST' }, responseHeaders);
    }
    if (text.length > maxTextCharacters) {
      return json(413, { error: 'TEXT_TOO_LONG', maxCharacters: maxTextCharacters }, responseHeaders);
    }

    const key = cacheKey(text);
    const cached = readCache(key);
    if (cached) return json(200, { ...cached, cached: true }, responseHeaders);
    try {
      const translated = await translateWithConfiguredProviders(text, env, { fetchImpl, now });
      writeCache(key, translated);
      return json(200, { ...translated, cached: false }, responseHeaders);
    } catch {
      // Do not expose provider errors, credentials, request text, or account state.
      return json(502, { error: 'TRANSLATION_UNAVAILABLE' }, responseHeaders);
    }
  };
}
