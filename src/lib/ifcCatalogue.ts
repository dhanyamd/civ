/**
 * The IFC model catalogue, fetched at runtime rather than hardcoded.
 *
 * Lists every IFC building in the web-ifc public test corpus, so the Generate
 * button can step through real models one after another instead of offering a
 * fixed handful. Nothing is bundled into this repo — each file is fetched from
 * its original host when you ask for it.
 */

const LISTING_URL =
  'https://api.github.com/repos/ThatOpen/engine_web-ifc/contents/tests/ifcfiles/public';
const RAW_BASE =
  'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/';

/** Anything much bigger than this takes too long to parse to be worth offering. */
const MAX_BYTES = 36 * 1024 * 1024;

export interface CatalogueEntry {
  name: string;
  url: string;
  sizeBytes: number;
  sizeLabel: string;
}

/** Turn a file name like `ISSUE_034_HouseZ.ifc` into something readable. */
function prettyName(file: string): string {
  const base = file.replace(/\.ifc$/i, '');
  const cleaned = base
    .replace(/^ISSUE_\d+_/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return base;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

let cached: CatalogueEntry[] | null = null;

export async function fetchIfcCatalogue(signal?: AbortSignal): Promise<CatalogueEntry[]> {
  if (cached) return cached;

  const res = await fetch(LISTING_URL, { signal });
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? 'GitHub rate-limited the model listing. Try again in a few minutes.'
        : `Could not list the IFC models (HTTP ${res.status}).`,
    );
  }

  const files = (await res.json()) as { name: string; size: number; type: string }[];

  cached = files
    .filter((f) => f.type === 'file' && /\.ifc$/i.test(f.name) && f.size > 0 && f.size <= MAX_BYTES)
    // Smallest first, so clicking Generate stays responsive as you go.
    .sort((a, b) => a.size - b.size)
    .map((f) => ({
      name: prettyName(f.name),
      url: RAW_BASE + encodeURIComponent(f.name),
      sizeBytes: f.size,
      sizeLabel: sizeLabel(f.size),
    }));

  return cached;
}
