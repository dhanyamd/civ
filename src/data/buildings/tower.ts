import type { BimElement, BuildingModel, Instance } from '@/types/studio';
import { atGrid, beamsAlongX, beamsAlongZ, glazingBand, gridLines, plate } from './helpers';

/**
 * Eight storey speculative office.
 *
 * Steel frame with composite metal deck slabs, an in-situ reinforced concrete
 * core for stability, and a unitised aluminium curtain wall. The interesting
 * tension in this building is that the frame is steel — so the single biggest
 * carbon lever is the steel supply route, not a change of material.
 */

const W = 36;
const D = 24;
const STOREY = 3.8;
const STOREYS = 8;
const TOP = STOREY * STOREYS;

const XS = gridLines(4, 9); // 9 m bays
const ZS = gridLines(3, 8); // 8 m bays

/** Repeat a generator over every storey. */
function overStoreys(make: (y: number, level: number) => Instance[], from = 0, count = STOREYS): Instance[] {
  return Array.from({ length: count }, (_, i) => make((from + i) * STOREY, from + i)).flat();
}

const CORE_X = -13.5;
const CORE_Z = 0;
const CORE_W = 9;
const CORE_D = 8;
const CORE_T = 0.4;

const coreWalls: Instance[] = [
  { pos: [CORE_X, TOP / 2, CORE_Z - CORE_D / 2], size: [CORE_W, TOP, CORE_T] },
  { pos: [CORE_X, TOP / 2, CORE_Z + CORE_D / 2], size: [CORE_W, TOP, CORE_T] },
  { pos: [CORE_X - CORE_W / 2, TOP / 2, CORE_Z], size: [CORE_T, TOP, CORE_D - CORE_T] },
  { pos: [CORE_X + CORE_W / 2, TOP / 2, CORE_Z], size: [CORE_T, TOP, CORE_D - CORE_T] },
];

const elements: BimElement[] = [
  {
    id: 'piled-raft',
    name: 'Piled raft and pile caps',
    role: 'foundation',
    instances: [plate(W + 2, D + 2, -1.2, 1.2), { pos: [CORE_X, -2.4, CORE_Z], size: [12, 1.4, 11] }],
    solidity: 1,
    span: 'Raft on 600 mm CFA piles, thickened under the core',
    exposure: 'Buried, permanently damp ground contact',
    note: 'The core raft is thickened to resist overturning from wind on a 30 m tall building.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98535, swapGroup: 'foundation-concrete', layer: 'Raft concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01465, swapGroup: 'rebar', layer: 'Reinforcement, 115 kg/m³' },
    ],
  },
  {
    id: 'core-walls',
    name: 'Reinforced concrete core',
    role: 'core-wall',
    instances: coreWalls,
    solidity: 1,
    span: '30.4 m full height, 400 mm walls',
    exposure: 'Internal, 120 minute fire compartment',
    note: 'Carries all wind load and provides the protected means of escape. Changing its material is a whole-scheme stability decision, not a swap.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98089, swapGroup: 'core-structure', layer: 'Wall concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01911, swapGroup: 'rebar', layer: 'Vertical and link steel, 150 kg/m³' },
    ],
  },
  {
    id: 'columns-steel',
    name: 'Steel columns',
    role: 'column',
    instances: overStoreys((y) => atGrid(XS, ZS, y + STOREY / 2, [0.36, STOREY, 0.36])),
    solidity: 0.135,
    span: '3.8 m storey height, 305 × 305 UC, 20 per floor',
    exposure: 'Internal, intumescent coated to 90 minutes',
    note: 'Solidity of 0.135 is the real steel area of a 305 UC inside its 360 mm envelope — this is why a steel frame weighs far less than it looks.',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'frame-column', layer: 'Universal columns' }],
  },
  {
    id: 'beams-primary',
    name: 'Primary steel beams',
    role: 'beam',
    instances: overStoreys((y) => beamsAlongZ(XS, y + STOREY - 0.25, D, [0.2, 0.5]), 1, STOREYS),
    solidity: 0.085,
    span: '8.0 m span, 457 × 191 UB',
    exposure: 'Internal, intumescent coated to 90 minutes',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'frame-beam', layer: 'Universal beams' }],
  },
  {
    id: 'beams-secondary',
    name: 'Secondary steel beams',
    role: 'beam',
    instances: overStoreys((y) => beamsAlongX(ZS, y + STOREY - 0.25, W, [0.15, 0.4]), 1, STOREYS),
    solidity: 0.108,
    span: '9.0 m span at 3.0 m centres, 356 × 171 UB',
    exposure: 'Internal, intumescent coated to 90 minutes',
    note: 'Composite with the slab through welded shear studs, which is what lets the sections stay shallow.',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'frame-beam', layer: 'Universal beams' }],
  },
  {
    id: 'composite-slabs',
    name: 'Composite floor slabs',
    role: 'slab',
    instances: overStoreys((y) => [plate(W, D, y + STOREY - 0.13, 0.13)], 1, STOREYS),
    solidity: 1,
    span: '3.0 m deck span onto secondary beams',
    exposure: 'Internal, dry',
    note: 'The single largest material quantity in the building, and the obvious place to look first.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98673, swapGroup: 'slab-structure', layer: '130 mm lightweight topping' },
      { materialId: 'steel-sheet-galv', fraction: 0.0069, swapGroup: 'fixed', layer: 'Profiled deck, 0.9 mm permanent formwork' },
      { materialId: 'rebar-virgin', fraction: 0.00637, swapGroup: 'rebar', layer: 'Mesh and shear studs, 50 kg/m³' },
    ],
  },
  {
    id: 'curtain-wall',
    name: 'Unitised curtain walling',
    role: 'glazing',
    instances: overStoreys((y) => glazingBand(W, D, y + 0.35, STOREY - 0.7, 0.14)),
    solidity: 0.14,
    span: 'Floor-to-floor unitised panels, 1.5 m module',
    exposure: 'External, full weather and UV exposure',
    note: 'Aluminium is only a third of the volume here but it dominates the carbon, because it is roughly seven times more intense per kilogram than the glass.',
    composition: [
      { materialId: 'glass-igu', fraction: 0.65, swapGroup: 'glazing-glass', layer: 'Sealed units, 2 × 6 mm panes' },
      { materialId: 'aluminium-primary', fraction: 0.35, swapGroup: 'glazing-frame', layer: 'Unitised frames and mullions, ~18 kg/m²' },
    ],
  },
  {
    id: 'spandrel-cladding',
    name: 'Spandrel and soffit cladding',
    role: 'cladding',
    instances: overStoreys((y) => glazingBand(W, D, y + STOREY - 0.72, 0.68, 0.1)),
    solidity: 0.9,
    span: 'Opaque spandrel zone at each floor edge',
    exposure: 'External, fully exposed',
    composition: [
      { materialId: 'aluminium-primary', fraction: 0.033, swapGroup: 'cladding', layer: 'Rainscreen panels, 3 mm sheet' },
      { materialId: 'mineral-wool', fraction: 0.967, swapGroup: 'insulation', layer: 'Backing insulation' },
    ],
  },
  {
    id: 'roof-build-up',
    name: 'Roof build-up',
    role: 'roof-covering',
    instances: [plate(W, D, TOP, 0.25)],
    solidity: 1,
    span: 'Flat warm roof over the top floor slab',
    exposure: 'Fully exposed, UV and ponding',
    composition: [
      { materialId: 'mineral-wool', fraction: 0.994, swapGroup: 'insulation', layer: '200 mm tapered insulation' },
      { materialId: 'epdm-membrane', fraction: 0.006, swapGroup: 'roof-covering', layer: 'Single ply waterproofing, 1.5 mm' },
    ],
  },
  {
    id: 'plant-screen',
    name: 'Rooftop plant and screen',
    role: 'cladding',
    instances: [
      { pos: [6, TOP + 1.6, 0], size: [12, 3.0, 9] },
      { pos: [6, TOP + 2.0, -5.2], size: [14, 3.6, 0.12] },
      { pos: [6, TOP + 2.0, 5.2], size: [14, 3.6, 0.12] },
      { pos: [13.4, TOP + 2.0, 0], size: [0.12, 3.6, 10.4] },
    ],
    solidity: 0.008,
    span: 'Louvred screen around air handling plant',
    exposure: 'Fully exposed at roof level',
    composition: [{ materialId: 'aluminium-primary', fraction: 1, swapGroup: 'cladding', layer: 'Louvre blades and framing' }],
  },
  {
    id: 'core-stairs',
    name: 'Core stairs and landings',
    role: 'stair',
    instances: overStoreys((y) => [
      { pos: [CORE_X - 2.2, y + STOREY / 2, CORE_Z], size: [3.6, 0.22, 6.8] },
      { pos: [CORE_X + 2.6, y + STOREY / 2, CORE_Z], size: [2.4, 0.22, 3.0] },
    ]),
    solidity: 1,
    span: 'Scissor stair, 3.8 m rise per storey',
    exposure: 'Internal, protected escape route',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98471, swapGroup: 'frame-column', layer: 'Precast flights' },
      { materialId: 'rebar-virgin', fraction: 0.01529, swapGroup: 'rebar', layer: 'Reinforcement, 120 kg/m³' },
    ],
  },
  {
    id: 'raised-floor',
    name: 'Raised access floor',
    role: 'finish',
    instances: overStoreys((y) => [plate(W - 1, D - 1, y + STOREY, 0.035)], 1, STOREYS),
    solidity: 0.4,
    span: '150 mm void across all office floors',
    exposure: 'Internal, dry',
    composition: [{ materialId: 'screed-sand-cement', fraction: 1, swapGroup: 'finish-screed', layer: 'Calcium sulphate panels' }],
  },
  {
    id: 'partitions-fitout',
    name: 'Fit-out partitions',
    role: 'wall-internal',
    instances: overStoreys((y) => [
      { pos: [4, y + STOREY / 2, 0], size: [0.1, STOREY - 0.5, D - 2] },
      { pos: [13, y + STOREY / 2, 0], size: [0.1, STOREY - 0.5, D - 2] },
      { pos: [8.5, y + STOREY / 2, -6], size: [9, STOREY - 0.5, 0.1] },
    ]),
    solidity: 0.3,
    span: 'Cellular offices and meeting rooms',
    exposure: 'Internal, dry',
    note: 'Short replacement cycle — often stripped out every ten years, so its carbon gets spent several times over a building life.',
    composition: [{ materialId: 'plasterboard', fraction: 1, swapGroup: 'finish-board', layer: 'Boarded stud partitions' }],
  },
  {
    id: 'ceilings',
    name: 'Suspended ceilings',
    role: 'finish',
    instances: overStoreys((y) => [plate(W - 1.2, D - 1.2, y + STOREY - 0.45, 0.02)], 1, STOREYS),
    solidity: 0.25,
    span: 'Across all office floors',
    exposure: 'Internal, dry',
    composition: [{ materialId: 'plasterboard', fraction: 1, swapGroup: 'finish-board', layer: 'Mineral tile and grid' }],
  },
];

export const TOWER: BuildingModel = {
  id: 'office-tower',
  name: 'Eight storey office',
  typology: 'Steel frame, composite slabs',
  description:
    'Steel frame with composite metal deck slabs, RC core and unitised curtain wall. 36 × 24 m, 30.4 m tall.',
  aiContext:
    'Eight-storey speculative office building, 36 × 24 m on a 9 × 8 m grid, 3.8 m storey heights, 30.4 m overall, 6912 m² GFA. Hot-rolled steel frame: 305 × 305 UC columns, 457 UB primary and 356 UB secondary beams acting composite with 130 mm lightweight concrete slabs on profiled steel deck. A single in-situ reinforced concrete core, 400 mm walls, carries all lateral load and provides the protected escape stair. Unitised aluminium curtain wall with sealed double glazed units, aluminium rainscreen spandrels, flat warm roof with single ply membrane, louvred rooftop plant screen. Steel is fire protected with intumescent coating to 90 minutes. Commercial office occupancy, speculative Category A fit-out.',
  grossFloorAreaM2: 6912,
  storeys: 8,
  siteSize: 72,
  elements,
  source: 'parametric',
};
