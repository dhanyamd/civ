import type { BimElement, BuildingModel, Instance } from '@/types/studio';
import { plate } from './helpers';

/**
 * Single storey distribution warehouse on a steel portal frame.
 *
 * Worth having in the library because its carbon profile is the opposite of
 * the office: almost nothing is in the frame, and an enormous share sits in one
 * element nobody thinks about — the power-floated ground slab.
 */

const W = 60; // along the ridge
const D = 30; // portal span
const EAVES = 9;
const RIDGE = 11.4;
const FRAMES = 11; // at 6 m centres
const SPACING = 6;

const frameX = Array.from({ length: FRAMES }, (_, i) => -W / 2 + i * SPACING);

const RISE = RIDGE - EAVES;
const RAFTER_LENGTH = Math.hypot(D / 2, RISE);
const PITCH = Math.atan2(RISE, D / 2);

/**
 * Portal rafters: one pitched box per half-span, tilted about X so the box
 * follows the roof slope. Length is the true sloping length, so the quantity
 * take-off counts the real steel rather than its plan projection.
 */
const rafters: Instance[] = frameX.flatMap((x) => [
  { pos: [x, EAVES + RISE / 2, -D / 4], size: [0.2, 0.62, RAFTER_LENGTH], rotX: -PITCH },
  { pos: [x, EAVES + RISE / 2, D / 4], size: [0.2, 0.62, RAFTER_LENGTH], rotX: PITCH },
]);

/** Purlins running the length of the building, stepped up both roof slopes. */
const purlins: Instance[] = Array.from({ length: 12 }, (_, i) => {
  const t = (i % 6) / 5;
  const slope = i < 6 ? -1 : 1;
  const z = slope * (D / 2) * (1 - t);
  const y = EAVES + RISE * t;
  return { pos: [0, y + 0.3, z], size: [W, 0.2, 0.17] } as Instance;
});

const sideRails: Instance[] = Array.from({ length: 10 }, (_, i) => {
  const y = 1.2 + (i % 5) * 1.8;
  const z = i < 5 ? -D / 2 : D / 2;
  return { pos: [0, y, z], size: [W, 0.15, 0.15] } as Instance;
});

const elements: BimElement[] = [
  {
    id: 'pad-foundations',
    name: 'Portal base pads',
    role: 'foundation',
    instances: frameX.flatMap((x) => [
      { pos: [x, -0.75, -D / 2], size: [2.6, 1.3, 2.6] } as Instance,
      { pos: [x, -0.75, D / 2], size: [2.6, 1.3, 2.6] } as Instance,
    ]),
    solidity: 1,
    span: '2.6 m square pads resisting portal base thrust',
    exposure: 'Buried, permanently damp ground contact',
    note: 'Sized by the horizontal thrust at the pinned base, not by vertical load.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98981, swapGroup: 'foundation-concrete', layer: 'Pad concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01019, swapGroup: 'rebar', layer: 'Reinforcement, 80 kg/m³' },
    ],
  },
  {
    id: 'ground-slab',
    name: 'Power floated ground slab',
    role: 'slab',
    instances: [plate(W, D, 0, 0.25)],
    solidity: 1,
    span: '1800 m² of jointless slab on a 300 mm sub-base',
    exposure: 'Internal, damp-proof membrane below, heavy forklift traffic',
    note: 'By far the biggest carbon item in the building. Steel fibre dosing and FM2 flatness are both specified for racking tolerance.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.99554, swapGroup: 'slab-structure', layer: 'Slab concrete, 250 mm' },
      { materialId: 'rebar-virgin', fraction: 0.00446, swapGroup: 'rebar', layer: 'Steel fibres and perimeter bars, 35 kg/m³' },
    ],
  },
  {
    id: 'portal-columns',
    name: 'Portal frame columns',
    role: 'column',
    instances: frameX.flatMap((x) => [
      { pos: [x, EAVES / 2, -D / 2], size: [0.25, EAVES, 0.68] } as Instance,
      { pos: [x, EAVES / 2, D / 2], size: [0.25, EAVES, 0.68] } as Instance,
    ]),
    solidity: 0.08,
    span: '9.0 m to eaves, 610 × 229 UB, 11 frames at 6 m',
    exposure: 'Internal, unprotected steel permitted',
    note: 'No fire protection needed: single storey, so there is nothing above to protect.',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'frame-column', layer: 'Universal beam columns' }],
  },
  {
    id: 'portal-rafters',
    name: 'Portal frame rafters',
    role: 'roof-structure',
    instances: rafters,
    solidity: 0.098,
    span: '30 m clear span, pitched at 8°, haunched at the eaves',
    exposure: 'Internal, unprotected steel permitted',
    note: 'A 30 m clear span is exactly where steel is hard to beat — few alternatives reach it without a deeper structural zone.',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'roof-structure', layer: 'Universal beam rafters' }],
  },
  {
    id: 'purlins-rails',
    name: 'Purlins and side rails',
    role: 'roof-structure',
    instances: [...purlins, ...sideRails],
    solidity: 0.03,
    span: '6.0 m span between frames, cold rolled zed sections',
    exposure: 'Internal face of the envelope',
    composition: [{ materialId: 'steel-sheet-galv', fraction: 1, swapGroup: 'roof-structure', layer: 'Cold rolled zed purlins' }],
  },
  {
    id: 'roof-sheeting',
    name: 'Roof sheeting and insulation',
    role: 'roof-covering',
    instances: [
      { pos: [0, EAVES + RISE / 2 + 0.45, -D / 4], size: [W, 0.14, RAFTER_LENGTH], rotX: -PITCH },
      { pos: [0, EAVES + RISE / 2 + 0.45, D / 4], size: [W, 0.14, RAFTER_LENGTH], rotX: PITCH },
    ],
    solidity: 1,
    span: 'Composite panels spanning 6 m between purlins',
    exposure: 'Fully exposed, wind uplift critical',
    composition: [
      { materialId: 'steel-sheet-galv', fraction: 0.0072, swapGroup: 'roof-covering', layer: 'Inner and outer liners, 2 × 0.5 mm' },
      { materialId: 'mineral-wool', fraction: 0.9928, swapGroup: 'insulation', layer: '120 mm insulation core' },
    ],
  },
  {
    id: 'wall-cladding',
    name: 'Wall cladding',
    role: 'cladding',
    instances: [
      { pos: [0, EAVES / 2 + 0.6, -D / 2 - 0.15], size: [W, EAVES - 1.2, 0.12] },
      { pos: [0, EAVES / 2 + 0.6, D / 2 + 0.15], size: [W, EAVES - 1.2, 0.12] },
      { pos: [-W / 2 - 0.15, EAVES / 2 + 0.6, 0], size: [0.12, EAVES - 1.2, D] },
      { pos: [W / 2 + 0.15, EAVES / 2 + 0.6, 0], size: [0.12, EAVES - 1.2, D] },
    ],
    solidity: 0.82,
    span: 'Horizontally spanning composite panels',
    exposure: 'External, fully exposed',
    composition: [
      { materialId: 'steel-sheet-galv', fraction: 0.0085, swapGroup: 'cladding', layer: 'Liner and weather sheet, 2 × 0.5 mm' },
      { materialId: 'mineral-wool', fraction: 0.9915, swapGroup: 'insulation', layer: '100 mm insulation core' },
    ],
  },
  {
    id: 'dado-wall',
    name: 'Impact dado wall',
    role: 'wall-external',
    instances: [
      { pos: [0, 0.9, -D / 2 - 0.1], size: [W, 1.8, 0.2] },
      { pos: [0, 0.9, D / 2 + 0.1], size: [W, 1.8, 0.2] },
      { pos: [-W / 2 - 0.1, 0.9, 0], size: [0.2, 1.8, D] },
      { pos: [W / 2 + 0.1, 0.9, 0], size: [0.2, 1.8, D] },
    ],
    solidity: 0.88,
    span: '1.8 m high blockwork dado below the cladding',
    exposure: 'External, splash zone and vehicle impact',
    composition: [{ materialId: 'block-dense-concrete', fraction: 1, swapGroup: 'wall-external-infill', layer: 'Dense blockwork' }],
  },
  {
    id: 'gable-posts',
    name: 'Gable posts and bracing',
    role: 'column',
    instances: [
      ...[-10, 0, 10].flatMap((z) => [
        { pos: [-W / 2, EAVES / 2, z], size: [0.2, EAVES, 0.4] } as Instance,
        { pos: [W / 2, EAVES / 2, z], size: [0.2, EAVES, 0.4] } as Instance,
      ]),
      { pos: [-W / 2 + 3, EAVES / 2, -D / 2], size: [6, 0.12, 0.12] },
      { pos: [W / 2 - 3, EAVES / 2, D / 2], size: [6, 0.12, 0.12] },
    ],
    solidity: 0.1,
    span: 'Wind posts to the gables plus plan bracing',
    exposure: 'Internal, unprotected',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'frame-column', layer: 'Hot-rolled sections' }],
  },
  {
    id: 'dock-doors',
    name: 'Loading dock doors and canopy',
    role: 'cladding',
    instances: [
      ...[-18, -9, 0, 9, 18].map((x) => ({ pos: [x, 2.4, -D / 2 - 0.25], size: [4.0, 4.8, 0.18] }) as Instance),
      { pos: [0, 5.4, -D / 2 - 1.8], size: [W - 8, 0.3, 3.2] },
    ],
    solidity: 0.25,
    span: '5 no. 4.0 × 4.8 m insulated sectional doors',
    exposure: 'External, fully exposed',
    composition: [
      { materialId: 'steel-sheet-galv', fraction: 0.012, swapGroup: 'cladding', layer: 'Door skins and canopy' },
      { materialId: 'eps', fraction: 0.988, swapGroup: 'insulation', layer: 'Door insulation core' },
    ],
  },
  {
    id: 'office-fitout',
    name: 'Ancillary office block',
    role: 'wall-internal',
    instances: [
      { pos: [-22, 1.6, 10], size: [14, 3.2, 0.1] },
      { pos: [-22, 1.6, 4], size: [14, 3.2, 0.1] },
      { pos: [-29, 1.6, 7], size: [0.1, 3.2, 6] },
      { pos: [-15, 1.6, 7], size: [0.1, 3.2, 6] },
      plate(14, 6, 3.2, 0.12, -22, 7),
    ],
    solidity: 0.3,
    span: 'Two storey office pod inside the shed',
    exposure: 'Internal, heated and dry',
    composition: [{ materialId: 'plasterboard', fraction: 1, swapGroup: 'finish-board', layer: 'Boarded stud construction' }],
  },
];

export const WAREHOUSE: BuildingModel = {
  id: 'distribution-warehouse',
  name: 'Distribution warehouse',
  typology: 'Single storey steel portal',
  description:
    'Steel portal frame at 6 m centres, 30 m clear span, composite cladding and a power floated slab. 60 × 30 m.',
  aiContext:
    'Single storey distribution warehouse, 60 × 30 m on plan, 1800 m² footprint, 9.0 m to eaves and 11.4 m to ridge. Eleven hot-rolled steel portal frames at 6 m centres giving a 30 m clear span, pitched at 8 degrees with haunched eaves connections, pinned bases on 2.6 m square pad foundations sized for base thrust. Cold rolled zed purlins and side rails, composite insulated roof and wall panels with steel liners, 1.8 m blockwork impact dado, five 4.0 × 4.8 m insulated sectional dock doors. A 250 mm jointless power floated ground bearing slab covers the whole footprint and takes heavy forklift and racking loads at FM2 flatness. Steel is unprotected, which single storey occupancy permits. A small two-storey ancillary office pod sits inside the envelope.',
  grossFloorAreaM2: 1800,
  storeys: 1,
  siteSize: 92,
  elements,
  source: 'parametric',
};
