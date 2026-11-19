import type { ElementRole, MaterialSpec } from '@/types/studio';

/**
 * Which materials may stand in for which, grouped by the job the material does
 * inside the element rather than by the element itself.
 *
 * This distinction matters. The rebar inside a reinforced concrete column and
 * the concrete around it are both "column" materials, but you cannot swap rebar
 * for glulam. Each composition part names its own swap group, so the candidate
 * list is always sane before the model is ever asked for an opinion.
 */
export type SwapGroup =
  | 'frame-beam'
  | 'frame-column'
  | 'slab-structure'
  | 'rebar'
  | 'foundation-concrete'
  | 'core-structure'
  | 'roof-structure'
  | 'roof-covering'
  | 'wall-external-infill'
  | 'wall-internal'
  | 'cladding'
  | 'glazing-glass'
  | 'glazing-frame'
  | 'insulation'
  | 'finish-screed'
  | 'finish-board'
  | 'fixed';

export const SWAP_GROUPS: Record<SwapGroup, string[]> = {
  'frame-beam': [
    'steel-section-virgin',
    'steel-section-eaf',
    'steel-reused',
    'glulam',
    'lvl',
    'bamboo-laminated',
    'steel-green-h2',
    'timber-reclaimed',
  ],
  'frame-column': [
    'steel-section-virgin',
    'steel-section-eaf',
    'steel-reused',
    'glulam',
    'bamboo-laminated',
    'concrete-c3240-cem1',
    'concrete-c3240-ggbs30',
    'concrete-limestone-calcined',
    'steel-green-h2',
    'concrete-geopolymer',
  ],
  'slab-structure': [
    'concrete-c3240-cem1',
    'concrete-c3240-ggbs30',
    'concrete-c3240-ggbs50',
    'concrete-limestone-calcined',
    'clt',
    'concrete-geopolymer',
    'concrete-carbon-cured',
    'concrete-recycled-aggregate',
  ],
  rebar: ['rebar-virgin', 'rebar-eaf', 'basalt-rebar'],
  'foundation-concrete': [
    'concrete-c3240-cem1',
    'concrete-c3240-ggbs30',
    'concrete-c3240-ggbs50',
    'concrete-limestone-calcined',
    'concrete-geopolymer',
    'concrete-carbon-cured',
    'concrete-recycled-aggregate',
  ],
  'core-structure': [
    'concrete-c3240-cem1',
    'concrete-c3240-ggbs30',
    'concrete-c3240-ggbs50',
    'concrete-limestone-calcined',
    'clt',
    'concrete-geopolymer',
    'concrete-carbon-cured',
  ],
  'roof-structure': [
    'steel-section-virgin',
    'steel-section-eaf',
    'steel-reused',
    'glulam',
    'lvl',
    'softwood-sawn',
    'bamboo-laminated',
    'clt',
    'steel-green-h2',
    'timber-reclaimed',
  ],
  'roof-covering': [
    'epdm-membrane',
    'clay-tile',
    'slate-natural',
    'zinc-standing-seam',
    'fibre-cement',
    'aluminium-recycled',
    'steel-sheet-galv',
    'green-roof-substrate',
  ],
  'wall-external-infill': [
    'brick-common',
    'block-aac',
    'block-dense-concrete',
    'ceb',
    'rammed-earth',
    'hempcrete',
    'clt',
    'straw-panel',
    'concrete-geopolymer',
  ],
  'wall-internal': ['block-aac', 'block-dense-concrete', 'brick-common', 'clt', 'ceb', 'plasterboard',
    'mycelium-composite',
    'straw-panel',],
  cladding: [
    'steel-sheet-galv',
    'aluminium-primary',
    'aluminium-recycled',
    'timber-rainscreen',
    'fibre-cement',
    'bamboo-scrimber',
    'slate-natural',
    'limestone',
    'brick-common',
    'cork-board',
    'timber-reclaimed',
  ],
  'glazing-glass': ['glass-igu', 'glass-igu-recycled'],
  'glazing-frame': ['aluminium-primary', 'aluminium-recycled', 'steel-section-eaf', 'glulam'],
  insulation: ['mineral-wool', 'eps', 'wood-fibre-board', 'cellulose-insulation', 'hempcrete',
    'cork-board',
    'sheep-wool-insulation',
    'mycelium-composite',
    'straw-panel',],
  'finish-screed': ['screed-sand-cement', 'lime-plaster'],
  'finish-board': ['plasterboard', 'lime-plaster', 'bamboo-scrimber',
    'mycelium-composite',
    'cork-board',],
  fixed: [],
};

/**
 * Thermal conductivity, W/m·K. Used to resize insulation swaps so the
 * comparison holds U-value constant — swapping a low-lambda product for a
 * higher-lambda one at the same thickness would be comparing a warm wall
 * against a cold one and calling it a carbon saving.
 */
export const THERMAL_LAMBDA: Record<string, number> = {
  'mineral-wool': 0.035,
  eps: 0.036,
  'wood-fibre-board': 0.038,
  'cellulose-insulation': 0.039,
  hempcrete: 0.07,
  'cork-board': 0.04,
  'sheep-wool-insulation': 0.038,
  'mycelium-composite': 0.04,
  'straw-panel': 0.045,
};

/**
 * Volume multiplier when substituting across material families for the same
 * structural duty. A glulam beam matching a steel beam's moment capacity is
 * several times the volume — ignoring that would invent carbon savings that
 * do not survive contact with a structural check.
 *
 * Values are design-stage rules of thumb derived from the ratio of design
 * strengths and typical realised section sizes, not a substitute for analysis.
 */
const FAMILY_SIZING: { roles: ElementRole[]; from: string; to: string; factor: number; why: string }[] = [
  // Steel frame to timber / bamboo
  { roles: ['beam', 'roof-structure'], from: 'steel', to: 'timber', factor: 4.0, why: 'equal moment capacity at typical depths' },
  { roles: ['beam', 'roof-structure'], from: 'steel', to: 'bamboo', factor: 3.6, why: 'equal moment capacity at typical depths' },
  { roles: ['column'], from: 'steel', to: 'timber', factor: 3.2, why: 'axial capacity plus buckling at storey height' },
  { roles: ['column'], from: 'steel', to: 'bamboo', factor: 3.0, why: 'axial capacity plus buckling at storey height' },
  // Steel frame to concrete
  { roles: ['beam'], from: 'steel', to: 'concrete', factor: 4.5, why: 'reinforced concrete beam depth for the same span' },
  { roles: ['column'], from: 'steel', to: 'concrete', factor: 3.5, why: 'concrete column size for the same axial load' },
  // Concrete to timber and back
  { roles: ['slab'], from: 'concrete', to: 'timber', factor: 1.3, why: 'CLT panel depth for the same span and deflection limit' },
  { roles: ['core-wall'], from: 'concrete', to: 'timber', factor: 1.5, why: 'CLT shear wall thickness for the same storey shear' },
  { roles: ['beam', 'roof-structure'], from: 'concrete', to: 'timber', factor: 0.85, why: 'glulam is deeper but far narrower' },
  { roles: ['column'], from: 'concrete', to: 'timber', factor: 0.95, why: 'comparable size, far lower self-weight' },
  { roles: ['column', 'beam'], from: 'concrete', to: 'steel', factor: 0.28, why: 'steel section replacing a concrete member' },
  { roles: ['slab'], from: 'concrete', to: 'steel', factor: 0.25, why: 'composite metal deck replacing a solid slab' },
  // Masonry walls: thickness changes with the material's load and insulation duty
  { roles: ['wall-external', 'wall-internal'], from: 'masonry', to: 'earth', factor: 1.6, why: 'earth walls are built thicker for the same duty' },
  { roles: ['wall-external', 'wall-internal'], from: 'masonry', to: 'timber', factor: 0.6, why: 'a CLT panel is thinner than a masonry leaf' },
  { roles: ['wall-external'], from: 'earth', to: 'masonry', factor: 0.62, why: 'fired masonry leaf is thinner than rammed earth' },
  // Rebar
  { roles: ['slab', 'foundation', 'wall-external'], from: 'steel', to: 'steel', factor: 1.0, why: 'same bar layout' },
];

export interface Sizing {
  factor: number;
  why: string | null;
}

/**
 * How much more (or less) material the substitute needs for the same duty.
 */
export function sizingFor(from: MaterialSpec, to: MaterialSpec, role: ElementRole): Sizing {
  // Insulation is compared at equal U-value, which is exact rather than a rule of thumb.
  const lambdaFrom = THERMAL_LAMBDA[from.id];
  const lambdaTo = THERMAL_LAMBDA[to.id];
  if (lambdaFrom && lambdaTo) {
    const factor = lambdaTo / lambdaFrom;
    return {
      factor,
      why: Math.abs(factor - 1) < 0.02 ? null : 'thickness adjusted to hold the same U-value',
    };
  }

  // Basalt rebar: same bar layout, so volume is unchanged but the density differs.
  if (from.family === to.family && from.id !== to.id) {
    const match = FAMILY_SIZING.find(
      (r) => r.from === from.family && r.to === to.family && r.roles.includes(role),
    );
    return { factor: match?.factor ?? 1, why: match?.why ?? null };
  }

  const match = FAMILY_SIZING.find(
    (r) => r.from === from.family && r.to === to.family && r.roles.includes(role),
  );
  if (match) return { factor: match.factor, why: match.why };

  // Cross-family with no documented rule: compare like-for-like volume and say so.
  if (from.family !== to.family) {
    return { factor: 1, why: 'compared at equal volume — no resizing rule for this pair' };
  }
  return { factor: 1, why: null };
}
