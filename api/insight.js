/**
 * Serverless wrapper around the framework-free AI handler — the third
 * transport `server/insight.mjs` was written to support, alongside the Vite
 * dev middleware and the standalone Node server.
 */
import { handleInsight } from '../server/insight.mjs';
import { aiConfig, readBody, sendJson } from './_ai.js';

// The handler gives the upstream model 90s; the platform caps a Hobby
// function at 60s, which is the real limit on a slow completion.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }
  try {
    const { status, body } = await handleInsight(readBody(req), aiConfig());
    sendJson(res, status, body);
  } catch (err) {
    sendJson(res, 400, { error: err?.message ?? 'Bad request.' });
  }
}
