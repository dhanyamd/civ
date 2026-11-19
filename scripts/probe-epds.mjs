/**
 * Diagnostic helper for scripts/fetch-epds.mjs.
 *
 *   node scripts/probe-epds.mjs "Gypsum plaster board" "Insulating glass"
 *
 * For each search term it prints every candidate with the three things that
 * decide whether a record is usable: the declared unit, whether a mass can be
 * derived from it, and the GWP split. Guessing at query strings without this
 * is how the wrong product ends up standing in for the right one.
 */

const BASE = 'https://oekobaudat.de/OEKOBAU.DAT/resource';

/**
 * Normalise Ökobaudat's unit strings.
 *
 * The API mixes notations: area is "qm" on most datasets and "m^2" on others,
 * volume is "cbm" or "m^3". Matching only the SI spellings silently rejected
 * every plasterboard, glass unit and membrane in the database, which is why
 * this is a lookup rather than a string compare.
 */
function normaliseUnit(raw) {
  const u = String(raw ?? '').trim().toLowerCase();
  if (['kg', 'kilogram'].includes(u)) return 'kg';
  if (['t', 'tonne', 'tonnes', 'ton'].includes(u)) return 't';
  if (['m^3', 'm3', 'cbm', 'cubic metre', 'cubic meter'].includes(u)) return 'm3';
  if (['m^2', 'm2', 'qm', 'sqm', 'square metre', 'square meter'].includes(u)) return 'm2';
  if (['m', 'lfm', 'metre', 'meter'].includes(u)) return 'm';
  return u;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function englishName(node) {
  const list = node?.shortDescription ?? node?.name ?? [];
  if (!Array.isArray(list)) return '';
  return list.find((s) => s.lang === 'en')?.value ?? list[0]?.value ?? '';
}

async function probe(term) {
  console.log(`\n${'='.repeat(100)}\n### ${term}`);
  let rows = [];
  try {
    rows = (
      await getJson(`${BASE}/processes?format=json&pageSize=10&search=true&name=${encodeURIComponent(term)}`)
    ).data ?? [];
  } catch (err) {
    console.log(`  search failed: ${err.message}`);
    return;
  }
  if (!rows.length) console.log('  (no results)');

  for (const row of rows) {
    const name = row.name ?? '(unnamed)';
    let detail;
    try {
      detail = await getJson(`${BASE}/processes/${row.uuid}?format=json&view=extended`);
    } catch {
      console.log(`  ${name.slice(0, 62).padEnd(64)} detail fetch failed`);
      continue;
    }

    const exchanges = detail?.exchanges?.exchange ?? [];
    const ref = exchanges.find((e) => e.referenceFlow) ?? exchanges[0];
    let unit = '?';
    let amount = null;
    for (const fp of ref?.flowProperties ?? []) {
      if (fp.referenceFlowProperty) {
        unit = fp.referenceUnit;
        amount = fp.meanValue;
      }
    }

    const props = {};
    for (const mp of ref?.materialProperties ?? []) props[mp.name] = mp.value;
    const density = props['gross density'];
    const grammage = props['grammage'];

    let fossil = null;
    for (const result of detail?.LCIAResults?.LCIAResult ?? []) {
      if (!/GWP-fossil/i.test(englishName(result.referenceToLCIAMethodDataSet))) continue;
      const hit = (result?.other?.anies ?? []).find((a) => a.module === 'A1-A3');
      if (hit) fossil = Number(hit.value);
    }

    const u = normaliseUnit(unit);
    const mass =
      u === 'kg' ? amount
        : u === 't' ? amount * 1000
          : u === 'm3' && density ? amount * density
            : u === 'm2' && grammage ? amount * grammage
              : null;

    const perKg = mass && fossil != null ? (fossil / mass).toFixed(4) : '—';
    const verdict = perKg === '—' ? (fossil == null ? 'NO GWP-fossil' : `NO MASS (${unit})`) : 'ok';

    console.log(
      `  ${name.slice(0, 58).padEnd(60)} ${String(amount).padStart(6)} ${String(unit).padEnd(5)}` +
        ` ρ=${String(density ?? '-').padStart(7)} g=${String(grammage ?? '-').padStart(7)}` +
        ` gwp=${String(fossil ?? '-').padStart(10)} -> ${perKg.padStart(9)}  ${verdict}`,
    );
  }
}

for (const term of process.argv.slice(2)) await probe(term);
