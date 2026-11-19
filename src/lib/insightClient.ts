import type { MaterialProfile, SubstitutionReview } from '@/types/studio';

/**
 * Calls the app's own /api/insight endpoint, which holds the Groq key
 * server-side. Nothing here ever sees the key.
 */

export interface InsightContext {
  material: string;
  role: string;
  elementName: string;
  quantities?: { volumeM3?: number; massKg?: number; count?: number };
  span?: string;
  exposure?: string;
  building?: string;
}

const GENERIC_ERROR = 'The AI service did not respond. Please retry.';

async function post(kind: 'profile' | 'review', payload: object, signal: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch('/api/insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...payload }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new Error('Could not reach the server. Is the dev server still running?');
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : GENERIC_ERROR;
    throw new Error(message);
  }
  return body;
}

function isProfile(v: unknown): v is MaterialProfile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Partial<MaterialProfile>;
  return typeof p.description === 'string' && Array.isArray(p.disadvantages);
}

function isReview(v: unknown): v is SubstitutionReview {
  return typeof v === 'object' && v !== null && Array.isArray((v as SubstitutionReview).options);
}

export async function fetchMaterialProfile(
  context: InsightContext,
  signal: AbortSignal,
): Promise<MaterialProfile> {
  const body = await post('profile', context, signal);
  if (!isProfile(body)) throw new Error('The AI answer came back incomplete. Please retry.');
  return body;
}

/** The model chooses the alternatives itself; nothing is pre-selected here. */
export async function fetchSubstitutionReview(
  context: InsightContext,
  signal: AbortSignal,
): Promise<SubstitutionReview> {
  const body = await post('review', context, signal);
  if (!isReview(body)) throw new Error('The AI answer came back incomplete. Please retry.');
  return body;
}

/** Whether the server has a key configured, so the UI can warn early. */
export async function fetchAiStatus(): Promise<{ aiConfigured: boolean; model?: string }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { aiConfigured: false };
    return (await res.json()) as { aiConfigured: boolean; model?: string };
  } catch {
    return { aiConfigured: false };
  }
}
