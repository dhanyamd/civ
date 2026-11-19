/**
 * Imports real Environmental Product Declarations from Ökobaudat and writes
 * `src/data/epds.json`.
 *
 * Ökobaudat is the German federal construction materials LCA database. Every
 * record is an EN 15804 compliant EPD with a UUID you can look up, so each
 * carbon factor in this app traces back to a published document rather than to
 * anything typed in from memory.
 *
 *   node scripts/fetch-epds.mjs
 *
 * Use scripts/probe-epds.mjs to see why a given search term fails before
 * changing its query here.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'https://oekobaudat.de/OEKOBAU.DAT/resource';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'epds.json');

/**
 * What to look for, per material in the app's catalogue.
 *
 * `queries` are tried in order. `require` is a hard gate — no match means no
 * record, rather than a record for a similar-but-different product. `avoid`
 * rejects outright, `prefer` only boosts.
 */
const WANTED_RAW = [
  // `require` is a hard gate: no match means no record, rather than a record
  // for a similar-but-different product.
{ id: 'steel-section-virgin', queries: ['Structural Steel Sections and merchant bars', 'Structural Steel Beams and Sections'], require: /structural steel.*(section|merchant|beam)/i, avoid: /galvani|verzinkt|end of life|plate[s]?$/i },
  { id: 'rebar-virgin', queries: ['Bewehrungsstahl', 'Betonstahl', 'Reinforcing steel'], require: /bewehrung|betonstahl|reinforc/i, avoid: /edelstahl|stainless/i },
  { id: 'steel-sheet-galv', queries: ['Bandverzinktes Stahlblech', 'Stahlblech feuerverzinkt', 'Galvanised steel sheet'], require: /(blech|sheet|coil|band).*(verzinkt|galvani)|(verzinkt|galvani).*(blech|sheet|coil|band)/i, avoid: /duct|kanal|lüftung|profil/i },

  { id: 'concrete-c3240-cem1', queries: ['Beton C30/37', 'Beton der Druckfestigkeitsklasse C30/37'], require: /beton|concrete/i, avoid: /leicht|faser|poren|lightweight|aerated|ziegel|stein|block|pflaster/i },
{ id: 'concrete-c3240-ggbs30', queries: ['Concrete blast furnace cement', 'Beton CEM III', 'Concrete CEM III/A'], require: /(concrete|beton).*(cem\s?iii|blast furnace|hochofen)|(cem\s?iii|blast furnace).*(concrete|beton)/i, avoid: /poren|aerated|block|stein/i },
{ id: 'concrete-c3240-ggbs50', queries: ['Concrete CEM III/B', 'Beton CEM III/B'], require: /cem\s?iii\s?\/\s?b/i },
{ id: 'concrete-recycled-aggregate', queries: ['Concrete recycled aggregate', 'Beton rezyklierte Gesteinskoernung', 'R-Beton'], require: /(concrete|beton).*(recycl|rezykl)|r-beton/i },

  { id: 'clt', queries: ['Brettsperrholz', 'Cross laminated timber'], require: /brettsperrholz|cross[\s-]*laminated|\bclt\b/i },
  { id: 'glulam', queries: ['Brettschichtholz', 'Glued laminated timber'], require: /brettschichtholz|glulam|glued laminated/i },
{ id: 'lvl', queries: ['Laminated veneer lumber', 'Furnierschichtholz'], require: /veneer lumber|furnierschicht|\blvl\b/i },
  { id: 'softwood-sawn', queries: ['Konstruktionsvollholz', 'Nadelschnittholz', 'Bauschnittholz'], require: /konstruktionsvollholz|schnittholz|solid construction timber|sawn/i, avoid: /brettschicht|brettsperr/i },
{ id: 'timber-rainscreen', queries: ['Thermally modified timber', 'Thermoholz', 'Wood facade cladding'], require: /thermally modified|thermoholz|(facade|fassade).*(wood|holz)|(wood|holz).*(facade|fassade)/i },

{ id: 'brick-common', queries: ['Vertically perforated clay brick', 'Clay brick unfilled', 'Facing brick'], require: /brick/i, avoid: /filled|insulat|polystyrol|polystyrene|unfired|lehm|roof|refractory/i },
  { id: 'block-aac', queries: ['Porenbeton Plansteine', 'Porenbetonstein', 'Autoclaved aerated concrete'], require: /porenbeton|aerated concrete/i },
{ id: 'block-dense-concrete', queries: ['Concrete masonry units', 'Normal concrete block', 'Betonmauersteine'], require: /(concrete|beton).*(block|masonry unit|mauerstein)|(block|masonry unit).*(concrete|beton)/i, avoid: /light|leicht|hollow|aerated|poren/i },
  { id: 'ceb', queries: ['Lehmsteine', 'Lehmziegel', 'Unfired clay brick'], require: /lehmstein|lehmziegel|unfired clay/i },
  { id: 'rammed-earth', queries: ['Stampflehm', 'Rammed earth'], require: /stampflehm|rammed earth/i },
{ id: 'hempcrete', queries: ['Hemp lime', 'Hanfkalk', 'Hemp shive'], require: /hemp|hanf/i, avoid: /insulation mat|dämmmatte/i },

  { id: 'mineral-wool', queries: ['Mineralwolle', 'Steinwolle Dämmstoff', 'Glaswolle Dämmstoff'], require: /mineralwolle|steinwolle|glaswolle|mineral wool|stone wool|glass wool/i, avoid: /sandwich|panel|paneel|faced|element|platte mit|verbund/i },
  { id: 'eps', queries: ['EPS Dämmstoff', 'Expandiertes Polystyrol'], require: /\beps\b|expandiert.*polystyrol|expanded polystyrene/i, avoid: /\bxps\b|extrudiert/i },
  { id: 'wood-fibre-board', queries: ['Holzfaserdämmplatte', 'Holzfaserdämmstoff'], require: /holzfaser|wood fib/i, avoid: /pyroresist|brandschutz|fire/i },
  { id: 'cellulose-insulation', queries: ['Zellulosefaser Dämmstoff', 'Zellulosedämmstoff', 'Cellulose insulation'], require: /zellulose|cellulos/i },
  { id: 'cork-board', queries: ['Korkdämmplatte', 'Expandierter Kork', 'Cork insulation board'], require: /kork|cork/i },
{ id: 'sheep-wool-insulation', queries: ['Sheep wool insulation', 'Schafwolle'], require: /sheep wool|schafwoll/i },
{ id: 'straw-panel', queries: ['Straw bale', 'Strohballen', 'Straw insulation'], require: /straw|stroh/i, avoid: /plaster|putz|clay|lehm|board with/i },

{ id: 'aluminium-primary', queries: ['Aluminium section semi-finished', 'Aluminium profiles'], require: /alumini(um|o).*(section|profile)/i, avoid: /recycl|sekundär|secondary|sash|powder coated|window/i },
{ id: 'aluminium-recycled', queries: ['Aluminium recycled profile', 'Aluminium secondary section', 'Aluminium sheet recycling'], require: /alumini.*(recycl|secondary|sekundär)|(recycl|secondary).*alumini/i },
{ id: 'zinc-standing-seam', queries: ['Titanium zinc sheet', 'Zinc sheet roofing', 'Titanzink'], require: /zinc|zink/i, avoid: /coating|galvani|oxide/i },

{ id: 'glass-igu', queries: ['Insulating glass unit double glazing', 'Insulated glazing double pane'], require: /(insulating glass|insulated glazing|double glaz).*(double|2)|double.*(glaz|glass)/i, avoid: /triple|3-fach|dreifach/i },
{ id: 'glass-igu-recycled', queries: ['Flat glass float', 'Float glass'], require: /flat glass|float glass|flachglas/i, avoid: /insulating|coated unit/i },

{ id: 'plasterboard', queries: ['Gypsum plaster board', 'Gypsum board for drywall'], require: /gypsum (plaster )?board|gipskarton|gipsplatte/i, avoid: /perforated|perforiert/i },
  { id: 'lime-plaster', queries: ['Kalkputz', 'Kalkmörtel', 'Lime plaster'], require: /kalkputz|kalkmörtel|lime plaster|lime mortar/i },
  { id: 'screed-sand-cement', queries: ['Zementestrich', 'Cement screed'], require: /zementestrich|cement screed/i },
{ id: 'fibre-cement', queries: ['Fibre cement board', 'Faserzement'], require: /fibre cement|fiber cement|faserzement/i },
{ id: 'epdm-membrane', queries: ['EPDM roof sheets', 'EPDM Dachbahn'], require: /epdm.*(roof|sheet|bahn|membrane)/i, avoid: /sealing profile|gasket|dichtprofil/i },
{ id: 'clay-tile', queries: ['Roof tile', 'Dachziegel'], require: /roof(ing)? tile|dachziegel/i, avoid: /concrete|beton|accessor/i },
{ id: 'slate-natural', queries: ['Natural slate roofing', 'Slate', 'Dachschiefer'], require: /slate|schiefer/i },
{ id: 'limestone', queries: ['Limestone natural stone', 'Kalkstein'], require: /limestone|kalkstein/i, avoid: /powder|mehl|filler/i },
{ id: 'green-roof-substrate', queries: ['Green roof substrate', 'Extensive green roof', 'Dachbegruenung'], require: /green roof|dachbegrünung|substrat/i },
{ id: 'bamboo-laminated', queries: ['Bamboo board', 'Bamboo flooring', 'Bambus'], require: /bamboo|bambus/i },

  // --- refinements, applied last so they win the de-duplication above ---
  // SALCOS is hydrogen-reduced steel: a real product, but not the conventional
  // baseline. Keeping the two apart matters, they differ by a factor of two.
  { id: 'steel-section-virgin', queries: ['Structural Steel Sections and merchant bars', 'Structural Steel Sections and Plates'], require: /structural steel.*(section|merchant|beam)/i, avoid: /salcos|green|h2|hydrogen|xcarb|galvani|verzinkt|end of life|heavy plate/i },
  { id: 'steel-green-h2', queries: ['SALCOS Structural Steel', 'Hydrogen reduced steel', 'Green steel sections'], require: /salcos|hydrogen|h2.?(dri|steel)|green steel/i },
  { id: 'steel-section-eu', queries: ['Structural Steel Sections and merchant bars'], require: /structural steel.*(section|merchant)/i, avoid: /salcos|green|galvani|end of life|plate/i },
  { id: 'steel-section-eaf', queries: ['Electric arc furnace steel', 'Elektrolichtbogenofen Stahl'], require: /(electric arc|eaf|elektrolichtbogen)/i },
  { id: 'rebar-eaf', queries: ['Reinforcing steel electric arc furnace', 'Betonstahl Elektrostahl'], require: /(reinforc|betonstahl|bewehrung).*(electric arc|eaf|elektro)/i },
  { id: 'steel-reused', queries: ['Reused structural steel'], require: /reused|wiederverwend/i },
  { id: 'basalt-rebar', queries: ['Basalt fibre reinforcement bar', 'GFRP reinforcement'], require: /(basalt|gfrp|glass fib).*(rebar|reinforc|bewehrung)/i },

  // A C12/15 mix is not a substitute for a C30/37 structural mix.
  { id: 'concrete-c3240-ggbs30', queries: ['Beton C30/37 CEM III', 'Concrete C30/37 blast furnace cement'], require: /(c\s?30\/37|c\s?25\/30).*(cem\s?iii|hochofen|blast furnace)|(cem\s?iii|hochofen|blast furnace).*(c\s?30\/37|c\s?25\/30)/i, avoid: /c\s?(8|12|16|20)\//i },
  { id: 'concrete-c3240-ggbs50', queries: ['Beton CEM III/B', 'Concrete CEM III/B'], require: /cem\s?iii\s?\/\s?b/i },
  { id: 'concrete-recycled-aggregate', queries: ['Beton rezyklierte Gesteinskoernung C30/37', 'R-Beton Transportbeton'], require: /(beton|concrete).*(rezykl|recycl)|r-beton/i, avoid: /paving|pflaster|stone|stein|block/i },
  { id: 'concrete-limestone-calcined', queries: ['Calcined clay cement', 'LC3 cement concrete'], require: /calcined clay|lc3/i },
  { id: 'concrete-geopolymer', queries: ['Geopolymer concrete', 'Alkali activated concrete'], require: /geopolymer|alkali.?activat/i },
  { id: 'concrete-carbon-cured', queries: ['CO2 cured concrete', 'carbon mineralised concrete'], require: /(co2|carbon).*(cured|mineralis|mineraliz)/i },

  // "Wood-chip concrete shuttering block" is not a dense concrete block.
  { id: 'block-dense-concrete', queries: ['Concrete masonry unit', 'Normalbeton Mauerstein', 'Concrete block masonry'], require: /(concrete|beton).*(block|masonry unit|mauerstein)/i, avoid: /wood.?chip|holzspan|light|leicht|aerated|poren|hollow|shuttering|schalung/i },

  // The previous run matched "non-slated bitumen sheets" on the word "slated".
  { id: 'slate-natural', queries: ['Roofing slate natural stone', 'Dachschiefer Naturschiefer'], require: /\b(slate|schiefer)\b/i, avoid: /bitumen|non.?slated|shingle|artificial/i },
  { id: 'limestone', queries: ['Limestone natural stone slab', 'Kalkstein Naturwerkstein'], require: /\b(limestone|kalkstein)\b/i, avoid: /powder|mehl|filler|cement|zement|aggregate/i },

  { id: 'aluminium-recycled', queries: ['Aluminium profile recycled content', 'Aluminium Recyclinganteil Profil'], require: /alumini.*(recycl|sekundär|secondary)/i, avoid: /semi-finished sheet/i },
  { id: 'zinc-standing-seam', queries: ['Titanzink Dachdeckung', 'Titanium zinc roofing', 'Zinc sheet roof'], require: /\b(zinc|zink)\b/i, avoid: /galvani|verzinkt|coating|oxide|die.?cast|alloy ingot/i },
  { id: 'lvl', queries: ['Laminated veneer lumber', 'Furnierschichtholz LVL'], require: /veneer lumber|furnierschicht/i },
  { id: 'timber-rainscreen', queries: ['Wood facade profile', 'Holzfassade Profilbretter', 'Thermally modified timber'], require: /(facade|fassade|cladding).*(wood|holz|timber)|(wood|holz|timber).*(facade|fassade|cladding)|thermally modified|thermoholz/i },
  { id: 'sheep-wool-insulation', queries: ['Sheep wool insulation', 'Schafwolle Dämmstoff'], require: /sheep wool|schafwoll/i },
  { id: 'bamboo-laminated', queries: ['Bamboo panel', 'Bambusplatte', 'Bamboo flooring'], require: /bamboo|bambus/i },
  { id: 'bamboo-scrimber', queries: ['Bamboo scrimber', 'Bamboo flooring'], require: /bamboo|bambus/i },
  { id: 'timber-reclaimed', queries: ['Altholz', 'Reclaimed timber'], require: /altholz|reclaimed timber/i },
  { id: 'mycelium-composite', queries: ['Mycelium composite', 'Myzel Dämmstoff'], require: /mycel|myzel/i },

  // ISOLENA is the only sheep wool dataset, and it answers to the bare German term.
  { id: 'sheep-wool-insulation', queries: ['Schafwolle', 'Sheep wool insulation'], require: /sheep.?s? wool|schafwoll/i },
  // The only EAF section dataset is hot-dip galvanised, whose zinc coat makes
  // it read higher than a plain section. Excluded rather than misrepresented.
  { id: 'steel-section-eaf', queries: ['Steel sections electric arc furnace', 'Elektrolichtbogenofen Stahlprofil'], require: /(electric arc|eaf|elektrolichtbogen)/i, avoid: /galvani|verzinkt|coated/i },
];

// Later entries win, so a refined query supersedes an earlier one for the same id.
const WANTED = [...new Map(WANTED_RAW.map((w) => [w.id, w])).values()];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < 2) {
      await sleep(900 * (attempt + 1));
      return getJson(url, attempt + 1);
    }
    throw err;
  }
}

function englishName(node, fallback = '') {
  const list = node?.shortDescription ?? node?.name ?? [];
  if (!Array.isArray(list)) return fallback;
  return (
    list.find((s) => s.lang === 'en')?.value ?? list.find((s) => s.lang === 'de')?.value ?? fallback
  );
}

/**
 * Normalise Ökobaudat's unit strings.
 *
 * The API mixes notations: area is "qm" on most datasets and "m^2" on others,
 * volume is "cbm" or "m^3". Matching only the SI spellings silently rejected
 * every plasterboard, glass unit and membrane in the database.
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

/**
 * GWP for modules A1–A3, split the way EN 15804+A2 reports it.
 *
 * This split is not optional for bio-based products. A CLT panel's GWP-total
 * is around -641 kgCO2e/m3 because the standard counts the carbon the tree
 * absorbed. Comparing that headline against concrete would be nonsense, so
 * GWP-fossil is the comparable figure and biogenic uptake is kept separate.
 */
function gwpModules(detail) {
  const out = { fossil: null, biogenic: null, total: null };

  for (const result of detail?.LCIAResults?.LCIAResult ?? []) {
    const name = englishName(result.referenceToLCIAMethodDataSet);
    let slot = null;
    if (/GWP-fossil|Global Warming Potential fossil/i.test(name)) slot = 'fossil';
    else if (/GWP-biogenic|Global Warming Potential biogenic/i.test(name)) slot = 'biogenic';
    else if (/GWP-total|Global Warming Potential total/i.test(name)) slot = 'total';
    if (!slot || out[slot] != null) continue;

    const anies = result?.other?.anies ?? [];
    const direct = anies.find((a) => a.module === 'A1-A3' && a.value != null);
    if (direct) {
      out[slot] = Number(direct.value);
      continue;
    }
    let sum = 0;
    let found = 0;
    for (const a of anies) {
      if (['A1', 'A2', 'A3'].includes(a.module) && a.value != null) {
        sum += Number(a.value);
        found += 1;
      }
    }
    if (found === 3) out[slot] = sum;
  }

  return out;
}

/** The declared unit and amount, plus whatever lets us convert it to a mass. */
function declaredUnit(detail) {
  const exchanges = detail?.exchanges?.exchange ?? [];
  const ref = exchanges.find((e) => e.referenceFlow) ?? exchanges[0];
  if (!ref) return null;

  let unit = null;
  let amount = null;
  for (const fp of ref.flowProperties ?? []) {
    if (fp.referenceFlowProperty) {
      unit = fp.referenceUnit;
      amount = Number(fp.meanValue);
    }
  }

  let density = null;
  let grammage = null;
  for (const mp of ref.materialProperties ?? []) {
    const label = mp.name ?? '';
    if (/gross density|rohdichte/i.test(label) && mp.value != null) density = Number(mp.value);
    if (/grammage|flächengewicht/i.test(label) && mp.value != null) grammage = Number(mp.value);
  }

  // Ökobaudat also publishes "conversion factor to 1 kg", but it is not used:
  // some datasets state it as kg per declared unit and others as its
  // reciprocal, which silently produced a factor six orders of magnitude out.
  return { unit, amount, density, grammage };
}

/** Mass in kg of the EPD's declared unit, or null if it cannot be derived. */
function declaredMassKg(declared) {
  if (!declared?.amount || !declared.unit) return null;
  const unit = normaliseUnit(declared.unit);

  if (unit === 'kg') return declared.amount;
  if (unit === 't') return declared.amount * 1000;
  if (unit === 'm3' && declared.density) {
    // A sane building material sits well inside this band.
    if (declared.density < 10 || declared.density > 9000) return null;
    return declared.amount * declared.density;
  }
  if (unit === 'm2' && declared.grammage) return declared.amount * declared.grammage;

  // Per-metre and per-piece declarations carry no geometry, so there is no
  // honest way to turn them into a mass.
  return null;
}

function scoreCandidate(row, want) {
  const name = row.name ?? '';
  if (!name) return -Infinity;
  if (want.avoid?.test(name)) return -Infinity;
  if (want.require && !want.require.test(name)) return -Infinity;

  let score = 0;
  if (want.prefer?.test(name)) score += 10;
  // Representative average datasets beat one manufacturer's product.
  if (/average dataset|repräsentativ|generic dataset|durchschnitt/i.test(row.subType ?? '')) score += 6;
  if (/specific dataset/i.test(row.subType ?? '')) score += 1;
  if ((row.compliance ?? []).some((c) => /15804\+A2/i.test(c.name ?? ''))) score += 3;
  if (row.validUntil && Number(row.validUntil) >= 2026) score += 2;
  if (row.refYear) score += Math.min(3, Math.max(0, (Number(row.refYear) - 2018) / 2));
  return score;
}

async function search(term) {
  const url = `${BASE}/processes?format=json&pageSize=18&search=true&name=${encodeURIComponent(term)}`;
  const body = await getJson(url);
  return body?.data ?? [];
}

async function resolve(want) {
  const seen = new Map();
  for (const query of want.queries) {
    let rows = [];
    try {
      rows = await search(query);
    } catch {
      continue;
    }
    for (const row of rows) if (row?.uuid && !seen.has(row.uuid)) seen.set(row.uuid, row);
    if (seen.size >= 16) break;
    await sleep(120);
  }

  const ranked = [...seen.values()]
    .map((row) => ({ row, score: scoreCandidate(row, want) }))
    .filter((c) => c.score > -Infinity)
    .sort((a, b) => b.score - a.score);

  for (const { row } of ranked.slice(0, 8)) {
    let detail;
    try {
      detail = await getJson(`${BASE}/processes/${row.uuid}?format=json&view=extended`);
    } catch {
      continue;
    }

    const gwp = gwpModules(detail);
    const declared = declaredUnit(detail);
    const massKg = declaredMassKg(declared);
    if (!massKg || !Number.isFinite(massKg) || massKg <= 0) continue;

    // GWP-fossil is the comparable headline; fall back to total only when the
    // dataset omits the split, and record which was used.
    const basis = gwp.fossil != null ? 'GWP-fossil' : gwp.total != null ? 'GWP-total' : null;
    const headline = gwp.fossil ?? gwp.total;
    if (headline == null || !Number.isFinite(headline)) continue;

    const perKg = headline / massKg;
    // Nothing in construction sits below ~0.001 or above ~30 kgCO2e/kg. Outside
    // that band the unit conversion went wrong, so drop the record.
    if (!Number.isFinite(perKg) || perKg < 0.001 || perKg > 30) continue;

    const density =
      declared.density ?? (normaliseUnit(declared.unit) === 'm3' ? massKg / declared.amount : null);

    return {
      materialId: want.id,
      epdName: row.name,
      uuid: row.uuid,
      url: `https://oekobaudat.de/OEKOBAU.DAT/datasetdetail/process.xhtml?uuid=${row.uuid}`,
      basis,
      gwpFossilA1A3: gwp.fossil != null ? Number(gwp.fossil.toFixed(4)) : null,
      gwpBiogenicA1A3: gwp.biogenic != null ? Number(gwp.biogenic.toFixed(4)) : null,
      gwpTotalA1A3: gwp.total != null ? Number(gwp.total.toFixed(4)) : null,
      declaredAmount: declared.amount,
      declaredUnit: declared.unit,
      declaredMassKg: Number(massKg.toFixed(4)),
      densityKgM3: density != null ? Number(density.toFixed(1)) : null,
      carbonPerKg: Number(perKg.toFixed(5)),
      biogenicPerKg: gwp.biogenic != null ? Number((gwp.biogenic / massKg).toFixed(5)) : null,
      refYear: row.refYear ?? null,
      validUntil: row.validUntil ?? null,
      subType: row.subType ?? null,
      compliance: (row.compliance ?? []).map((c) => c.name).filter(Boolean),
    };
  }

  return null;
}

const found = [];
const missing = [];

for (const want of WANTED) {
  process.stdout.write(`${want.id.padEnd(30)} `);
  try {
    const hit = await resolve(want);
    if (hit) {
      found.push(hit);
      console.log(`${String(hit.carbonPerKg).padEnd(9)} [${hit.basis}]  ${hit.epdName.slice(0, 50)}`);
    } else {
      missing.push(want.id);
      console.log('no usable EPD');
    }
  } catch (err) {
    missing.push(want.id);
    console.log(`failed: ${err.message}`);
  }
  await sleep(120);
}

const payload = {
  source: 'Ökobaudat — German Federal Ministry for Housing, Urban Development and Building',
  sourceUrl: 'https://oekobaudat.de',
  note: 'EN 15804 EPDs. GWP-fossil, modules A1–A3 (product stage), converted to kgCO2e per kg using the dataset own declared unit with its gross density or grammage.',
  fetchedAt: new Date().toISOString().slice(0, 10),
  records: found.sort((a, b) => a.materialId.localeCompare(b.materialId)),
};

await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`\nWrote ${found.length} EPDs to src/data/epds.json`);
if (missing.length) console.log(`No EPD found for: ${missing.join(', ')}`);
