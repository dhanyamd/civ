/**
 * Node-request plumbing shared by the Vite dev middleware and the standalone
 * production server. Keeps `insight.mjs` free of transport concerns.
 */
import { handleInsight, resolveProvider } from './insight.mjs';

const MAX_BODY_BYTES = 64 * 1024;

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Request body was not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handle an /api/* request. Returns true if it owned the request.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {() => {openrouterKey?: string, groqKey?: string, model?: string}} getConfig
 */
export async function handleApi(req, res, getConfig) {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/health') {
    const provider = resolveProvider(getConfig());
    send(res, 200, {
      ok: true,
      aiConfigured: Boolean(provider),
      provider: provider?.name ?? null,
      model: provider?.model ?? null,
    });
    return true;
  }

  if (url.pathname !== '/api/insight') return false;

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Use POST.' });
    return true;
  }

  try {
    const body = await readJsonBody(req);
    const { status, body: payload } = await handleInsight(body, getConfig());
    send(res, status, payload);
  } catch (err) {
    send(res, 400, { error: err?.message ?? 'Bad request.' });
  }
  return true;
}
