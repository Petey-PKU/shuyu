import { createServer } from 'node:http';
import { createTranslationGateway } from './src/gateway.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const port = Number.parseInt(process.env.PORT || '9000', 10);
const handleRequest = createTranslationGateway();

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('Request body too large'), { code: 'BODY_TOO_LARGE' }));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', reject);
  });
}

function clientAddress(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return request.socket.remoteAddress || 'unknown';
}

const server = createServer(async (request, response) => {
  try {
    const body = request.method === 'POST' ? await readBody(request) : undefined;
    const result = await handleRequest({
      method: request.method,
      url: `http://${request.headers.host || 'localhost'}${request.url || '/'}`,
      headers: request.headers,
      body,
      clientAddress: clientAddress(request),
    });
    response.writeHead(result.status, result.headers);
    response.end(result.body === undefined ? undefined : JSON.stringify(result.body));
  } catch (error) {
    const status = error?.code === 'BODY_TOO_LARGE' ? 413 : 500;
    response.writeHead(status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ error: status === 413 ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR' }));
  }
});

server.listen(port, '0.0.0.0');
