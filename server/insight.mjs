/**
 * Framework-free AI handler.
 *
 * Deliberately knows nothing about HTTP so the same code can run behind the
 * Vite dev middleware, the standalone Node server, or a serverless wrapper.
 *
 * Division of labour:
 *   - Quantities (volume, mass) come from the model geometry in the browser.
 *   - The current material's name comes from the building or the IFC file.
 *   - Everything else here — the descriptions, the disadvantages, the list of
 *     alternatives and their carbon and cost estimates — is written by the
 *     model. Those percentages are informed estimates, not measured values,
 *     and the UI labels them as such.
 */

/**
 * Providers, in preference order. OpenRouter is used when a key for it is
 * present; Groq is the fallback.
 *
 * Both speak the OpenAI chat-completions shape, so only the endpoint, the
 * default model and the token-limit parameter name differ.
 */
const PROVIDERS = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'google/gemini-3.8-flash',
    maxTokensField: 'max_tokens',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // OpenRouter attributes usage to these; harmless if the app is local.
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Material Studio',
    }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'openai/gpt-oss-120b',
    maxTokensField: 'max_completion_tokens',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
  },
};

const TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 4000;

/**
 * Decide which provider to talk to from whatever keys are configured.
 * @param {{openrouterKey?: string, groqKey?: string, model?: string}} config
 */
export function resolveProvider(config = {}) {
  if (config.openrouterKey) {
    return {
      name: 'openrouter',
      key: config.openrouterKey,
      model: config.model || PROVIDERS.openrouter.defaultModel,
      ...PROVIDERS.openrouter,
    };
  }
  if (config.groqKey) {
    return {
      name: 'groq',
      key: config.groqKey,
      model: config.model || PROVIDERS.groq.defaultModel,
      ...PROVIDERS.groq,
    };
  }
  return null;
}

const SYSTEM_PROMPT = `You are a chartered structural and materials engineer advising on embodied-carbon reduction for a building project.

Rules you must follow:
- Be specific to the element described. A foundation, a transfer beam and a partition wall have completely different constraints.
- Base your carbon and cost estimates on published LCA data you know, such as the ICE database and EN 15804 EPDs. Give realistic percentages, not round guesses, and keep them consistent with the relative ordering those sources would give.
- Fire resistance, durability in ground contact, moisture exposure, span and axial capacity, acoustic separation and code acceptance are all legitimate reasons to rule an option out. Do not propose something that fails one of them.
- Write for a competent engineer. No marketing language, no hedging filler, no restating the question.
- Keep every string under 220 characters. Plain sentences.
- Reply with valid JSON only, matching the requested shape exactly.`;

/** @param {string} s @param {number} n */
function clampText(s, n) {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** @param {unknown} v @param {number} max @param {number} len */
function clampList(v, max, len) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string' && x.trim())
    .slice(0, max)
    .map((x) => clampText(x, len));
}

/** Describe the element in the words an engineer would use. */
function describeElement(p) {
  const q = p.quantities ?? {};
  const bits = [
    `Element: ${p.elementName || 'unnamed element'}`,
    `Structural role: ${p.role || 'unknown'}`,
    `Current material: ${p.material || 'unknown'}`,
  ];
  if (q.volumeM3) bits.push(`Volume: ${Number(q.volumeM3).toFixed(2)} m3`);
  if (q.massKg) bits.push(`Mass: ${Math.round(Number(q.massKg)).toLocaleString('en-GB')} kg`);
  if (q.count && q.count > 1) bits.push(`Instances in model: ${q.count}`);
  if (p.span) bits.push(`Governing span: ${p.span}`);
  if (p.exposure) bits.push(`Exposure: ${p.exposure}`);
  if (p.building) bits.push(`Building context: ${p.building}`);
  return bits.join('\n');
}

const PROFILE_SHAPE = `{
  "description": string,                   // 4-6 sentences: what this material is, how it is made, and why it ends up in THIS element. Write it as flowing prose, not a list.
  "disadvantages": [string]                // 4-5 items: environmental, health and practical downsides. One full sentence each.
}`;

const REVIEW_SHAPE = `{
  "options": [
    {
      "name": string,                      // the alternative material, e.g. "Cross-laminated timber (CLT)"
      "description": string,               // 3-5 sentences: what it is, how it is made, and how it would work in THIS element. Flowing prose.
      "advantages": [string],              // 3-4 items, one full sentence each
      "carbonDeltaPct": number,            // your best estimate of the change in embodied carbon vs the current material, as a percentage. Negative means lower.
      "costDeltaPct": number,              // same for cost. Negative means cheaper.
      "caution": string                    // one sentence: the main thing that could stop this working here. Empty string if nothing significant.
    }
  ]
}`;

function buildPrompt(kind, payload) {
  const element = describeElement(payload);

  if (kind === 'profile') {
    return `${element}

Profile the current material as used in this element. Return JSON of exactly this shape:
${PROFILE_SHAPE}`;
  }

  return `${element}

Propose 4 to 6 lower-impact materials that could replace the current material in this element. Choose them yourself from the full range of construction materials — conventional low-carbon options, bio-based materials and emerging products all count.

Rules for this list:
- Every option must be able to do this element's actual job. Do not offer a non-structural material for a structural element, or an unprotected combustible where fire resistance governs.
- Order them best first.
- Give your honest best estimate of the carbon and cost change as percentages. If an option is more expensive, say so with a positive number.
- Say in "caution" what would most likely stop it being used here.

Return JSON of exactly this shape:
${REVIEW_SHAPE}`;
}

function normaliseProfile(raw) {
  return {
    description: clampText(raw.description || '', 1200),
    disadvantages: clampList(raw.disadvantages, 5, 300),
  };
}

/** Keep a percentage believable without silently rewriting the model's answer. */
function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(-99, Math.min(500, Math.round(n)));
}

function normaliseReview(raw) {
  return {
    options: (Array.isArray(raw.options) ? raw.options : [])
      .filter((o) => o && typeof o.name === 'string' && o.name.trim())
      .slice(0, 6)
      .map((o, i) => ({
        id: `${i}-${String(o.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: clampText(o.name, 80),
        description: clampText(o.description || '', 900),
        advantages: clampList(o.advantages, 4, 300),
        carbonDeltaPct: clampPct(o.carbonDeltaPct),
        costDeltaPct: clampPct(o.costDeltaPct),
        caution: clampText(o.caution || '', 300),
      })),
  };
}

/**
 * @param {{kind: string} & Record<string, unknown>} body
 * @param {{openrouterKey?: string, groqKey?: string, model?: string}} config
 * @returns {Promise<{status: number, body: unknown}>}
 */
export async function handleInsight(body, config) {
  const kind = body?.kind;
  if (kind !== 'profile' && kind !== 'review') {
    return { status: 400, body: { error: 'kind must be "profile" or "review".' } };
  }
  if (!body?.material || !body?.role) {
    return { status: 400, body: { error: 'material and role are required.' } };
  }
  const provider = resolveProvider(config);
  if (!provider) {
    return {
      status: 503,
      body: {
        error:
          'No AI key on the server. Add OPENROUTER_API_KEY (or GROQ_API_KEY) to .env and restart, then reload this page.',
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: provider.headers(provider.key),
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.25,
        [provider.maxTokensField]: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(kind, body) },
        ],
      }),
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      let detail = '';
      try {
        detail = JSON.parse(text)?.error?.message ?? '';
      } catch {
        detail = '';
      }
      if (res.status === 401) {
        return { status: 502, body: { error: `${provider.name} rejected the API key. Check your key in .env.` } };
      }
      if (res.status === 429) {
        return { status: 502, body: { error: `${provider.name} rate limit reached. Wait a few seconds and retry.` } };
      }
      return {
        status: 502,
        body: { error: clampText(detail || `${provider.name} returned HTTP ${res.status}.`, 240) },
      };
    }

    const completion = JSON.parse(text);
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return { status: 502, body: { error: `${provider.name} returned an empty answer. Retry.` } };
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { status: 502, body: { error: `${provider.name} returned malformed JSON. Retry.` } };
    }

    const result = kind === 'profile' ? normaliseProfile(parsed) : normaliseReview(parsed);
    return { status: 200, body: { ...result, model: provider.model } };
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { status: 504, body: { error: 'The AI request timed out. Retry.' } };
    }
    return { status: 502, body: { error: clampText(err?.message || `Could not reach ${provider.name}.`, 240) } };
  } finally {
    clearTimeout(timer);
  }
}


