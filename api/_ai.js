/**
 * Shared helpers for the serverless /api functions.
 *
 * The standalone server (`server/index.mjs`) falls back to reading `.env` off
 * disk; here there is no disk to read from — `.env` is gitignored and never
 * deployed — so keys come from the project's environment variables only.
 */

export function aiConfig() {
  return {
    openrouterKey: process.env.OPENROUTER_API_KEY,
    groqKey: process.env.GROQ_API_KEY,
    model: process.env.AI_MODEL,
  };
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

/**
 * The platform parses JSON request bodies before the handler runs, so the
 * stream is already consumed and `server/http.mjs`'s reader cannot be reused.
 * A string body means the parser declined it (wrong or missing content-type).
 */
export function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Request body was not valid JSON.');
    }
  }
  return req.body ?? {};
}
