/** Tells the UI whether a key is configured, so it can warn before a click. */
import { resolveProvider } from '../server/insight.mjs';
import { aiConfig, sendJson } from './_ai.js';

export default function handler(_req, res) {
  const provider = resolveProvider(aiConfig());
  sendJson(res, 200, {
    ok: true,
    aiConfigured: Boolean(provider),
    provider: provider?.name ?? null,
    model: provider?.model ?? null,
  });
}
