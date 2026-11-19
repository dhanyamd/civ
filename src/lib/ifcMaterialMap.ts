import { maybeMaterial } from '@/data/materials';
import type { ElementRole, MaterialSpec } from '@/types/studio';

/**
 * Maps the material names an IFC file actually contains onto the carbon
 * dataset.
 *
 * This is the "structuring" step, and it is deliberately visible: the UI shows
 * the raw IFC string next to whatever it matched, so a wrong match is obvious
 * rather than buried. Nothing is guessed silently — an unmatched name is
 * reported as unmatched and carries no carbon figure.
 *
 * Rules are ordered; the first hit wins, so put the specific ones first.
 */
interface Rule {
  test: RegExp;
  materialId: string | null;
  /** null materialId means "real, but carries no embodied carbon here" */
  reason?: string;
}

const RULES: Rule[] = [
  // Non-materials that appear in IFC layer sets
  { test: /air\s*(space|layer|gap|cavity)|luftschicht/i, materialId: null, reason: 'Air layer — no material, no carbon' },
  { test: /^\s*(default|unnamed|<unnamed>|empty|empty fill|solid|solid fill|by category)\s*$/i, materialId: null, reason: 'Placeholder, not a real material' },
  { test: /projektnullpunkt|schnittmaterial|^\s*(post|drop beam)\s*$/i, materialId: null, reason: 'Modelling aid, not a building material' },
  { test: /\b(grass|soil|topsoil|gravel|sand|water|umgebung|erde|kies)\b/i, materialId: null, reason: 'Ground or site material — not costed here' },
  { test: /vapou?r barrier|dpm|separator|pe[\s-]*separator|markierung/i, materialId: null, reason: 'Thin barrier or marking layer — not costed here' },

  // Reinforced concrete must be caught before the steel rules: "Stahlbeton"
  // contains "Stahl" but is concrete, not a steel section.
  { test: /stahlbeton|reinforced concrete|ortbeton|fertigbeton/i, materialId: 'concrete-c3240-cem1' },

  // Steel, most specific first
  { test: /steel.*\b(\d{3})\s*mpa/i, materialId: 'steel-section-virgin' },
  { test: /\b(s235|s275|s355|s460)\b/i, materialId: 'steel-section-virgin' },
  { test: /baustahl|structural steel|steel\s*[-–]\s*structural/i, materialId: 'steel-section-virgin' },
  { test: /stainless|edelstahl/i, materialId: 'steel-section-virgin', reason: undefined },
  { test: /steel\s*[-–]\s*(deck|light frame|sheet|profiled|cladding)|colorbond|trapezblech/i, materialId: 'steel-sheet-galv' },
  { test: /verzinkt|galvanis/i, materialId: 'steel-sheet-galv' },
  // "Stahl" on its own, after the Stahlbeton rule above has had its chance.
  { test: /\bstahl\b/i, materialId: 'steel-section-virgin' },
  { test: /\b(rebar|reinforc\w*\s*bar|reinforcement)\b/i, materialId: 'rebar-virgin' },
  { test: /stud\s*layer|metal\s*stud|firring|furring/i, materialId: 'steel-sheet-galv' },
  { test: /chain\s*link|steel\s*(sheet|deck|profiled|cladding)/i, materialId: 'steel-sheet-galv' },
  { test: /\b(steel|metal\s*-\s*steel)\b/i, materialId: 'steel-section-virgin' },

  // Other metals
  { test: /alumini?um/i, materialId: 'aluminium-primary' },
  { test: /\b(zinc|zink)\b/i, materialId: 'zinc-standing-seam' },

  // Concrete and masonry
  { test: /concrete\s*block|block.*concrete/i, materialId: 'block-dense-concrete' },
  { test: /aerated|aac|autoclav/i, materialId: 'block-aac' },
  { test: /\b(grout|mortar|screed)\b/i, materialId: 'screed-sand-cement' },
  { test: /cast[\s-]*in[\s-]*(situ|place)|in[\s-]*situ.*concrete|concrete|\bbeton\b/i, materialId: 'concrete-c3240-cem1' },
  { test: /\b(brick|ziegel)\b|masonry.*brick|face brick|brick paving/i, materialId: 'brick-common' },
  { test: /\b(stone|granite|limestone|naturstein|granit|kalkstein)\b/i, materialId: 'limestone' },
  { test: /\b(slate|schiefer)\b/i, materialId: 'slate-natural' },
  { test: /\bbitumen\b/i, materialId: 'epdm-membrane' },
  { test: /fib(re|er)\s*cement|faserzement/i, materialId: 'fibre-cement' },

  // Envelope
  { test: /epdm|single\s*ply|roofing.*(membrane|barrier)|membrane\s*[-–]\s*(water|rain)proof|abdichtung/i, materialId: 'epdm-membrane' },
  { test: /rigid\s*insulation|\beps\b|xps|polystyrene|plastic hard|insulated\s*panel/i, materialId: 'eps' },
  { test: /semi[\s-]*rigid|mineral\s*wool|glass\s*wool|rock\s*wool|fiber hard|insulation|dämmung|dämmstoff/i, materialId: 'mineral-wool' },
  { test: /\b(glass|glazing|glazed|glas)\b/i, materialId: 'glass-igu' },

  // Timber
  { test: /\b(clt|cross[\s-]*laminated)\b/i, materialId: 'clt' },
  { test: /\bglulam|glued\s*laminated\b/i, materialId: 'glulam' },
  { test: /plywood|sheathing|osb|lvl|veneer/i, materialId: 'lvl' },
  { test: /\b(wood|timber|lumber|softwood|hardwood|holz)\b|wall plate/i, materialId: 'softwood-sawn' },
  { test: /\bbamboo\b/i, materialId: 'bamboo-laminated' },

  // Finishes
  { test: /plasterboard|gypsum|drywall|type[\s-]*x|\bgips\b/i, materialId: 'plasterboard' },
  { test: /ceiling\s*tile|ceiling\s*[-–]\s*plasterboard/i, materialId: 'plasterboard' },
  { test: /ceramic|porcelain|clay\s*tile|roof\s*tile|tiled|fliese/i, materialId: 'clay-tile' },
  { test: /\brender\b|float\s*&\s*set|rough\s*2c|\bputz\b/i, materialId: 'lime-plaster' },
  { test: /grano|mortar|estrich|sub-?flooring/i, materialId: 'screed-sand-cement' },
  { test: /\b(lime\s*plaster|render|stucco)\b/i, materialId: 'lime-plaster' },
  { test: /\b(laminate|vinyl|carpet|paint|coating)\b/i, materialId: null, reason: 'Thin applied finish — not costed here' },
];

export interface MaterialMatch {
  /** the string exactly as it appears in the IFC file */
  ifcName: string;
  spec: MaterialSpec | null;
  /** why there is no spec, when there is none */
  reason: string | null;
  matched: boolean;
}

export function matchIfcMaterial(ifcName: string): MaterialMatch {
  const name = (ifcName ?? '').trim();
  if (!name) {
    return { ifcName, spec: null, reason: 'Blank material name in the file', matched: false };
  }

  for (const rule of RULES) {
    if (!rule.test.test(name)) continue;
    if (rule.materialId === null) {
      return { ifcName: name, spec: null, reason: rule.reason ?? 'Carries no embodied carbon', matched: true };
    }
    const spec = maybeMaterial(rule.materialId);
    if (spec) return { ifcName: name, spec, reason: null, matched: true };
  }

  return {
    ifcName: name,
    spec: null,
    reason: 'No match in the carbon dataset — add a rule or an EPD for this material',
    matched: false,
  };
}

/** Best-guess structural role from the IFC entity type, used to pick substitutes. */
export function roleFromIfcType(ifcType: string): ElementRole {
  const t = (ifcType ?? '').toUpperCase();
  if (t.includes('FOOTING') || t.includes('PILE')) return 'foundation';
  if (t.includes('COLUMN')) return 'column';
  if (t.includes('BEAM')) return 'beam';
  if (t.includes('SLAB')) return 'slab';
  if (t.includes('WINDOW') || t.includes('CURTAIN') || t.includes('PLATE')) return 'glazing';
  if (t.includes('DOOR')) return 'cladding';
  if (t.includes('ROOF')) return 'roof-covering';
  if (t.includes('STAIR') || t.includes('RAMP')) return 'stair';
  if (t.includes('COVERING')) return 'finish';
  if (t.includes('WALL')) return 'wall-external';
  if (t.includes('MEMBER')) return 'beam';
  return 'misc';
}

/** The swap pool that fits a role, so Optimise works on IFC elements too. */
export function swapGroupForRole(role: ElementRole): string {
  switch (role) {
    case 'foundation':
      return 'foundation-concrete';
    case 'column':
      return 'frame-column';
    case 'beam':
      return 'frame-beam';
    case 'slab':
      return 'slab-structure';
    case 'core-wall':
      return 'core-structure';
    case 'wall-external':
      return 'wall-external-infill';
    case 'wall-internal':
      return 'wall-internal';
    case 'roof-structure':
      return 'roof-structure';
    case 'roof-covering':
      return 'roof-covering';
    case 'glazing':
      return 'glazing-glass';
    case 'cladding':
      return 'cladding';
    case 'insulation':
      return 'insulation';
    case 'finish':
      return 'finish-board';
    default:
      return 'cladding';
  }
}
