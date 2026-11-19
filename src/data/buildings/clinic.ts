import type { BimElement, BuildingModel } from '@/types/studio';
import { atGrid, beamsAlongX, beamsAlongZ, glazingBand, gridLines, perimeterWalls, plate } from './helpers';

/**
 * Two-storey community health clinic.
 *
 * Reinforced concrete frame on pad foundations, brick cavity walls, flat roof.
 * This is the most ordinary building type there is, which is the point: the
 * carbon is overwhelmingly in the frame and slabs, not in the visible finishes.
 */

const W = 30;
const D = 18;
const STOREY = 4.0;
const BAY = 6;

const XS = gridLines(5, BAY); // 5 bays over 30 m
const ZS = gridLines(3, BAY); // 3 bays over 18 m

const elements: BimElement[] = [
  {
    id: 'pad-foundations',
    name: 'Pad foundations',
    role: 'foundation',
    instances: atGrid(XS, ZS, -0.5, [2.2, 0.9, 2.2]),
    solidity: 1,
    span: '2.2 m square pads at 6 m grid intersections',
    exposure: 'Buried, permanently damp ground contact',
    note: 'Sized for a 150 kPa allowable bearing pressure on firm clay.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98981, swapGroup: 'foundation-concrete', layer: 'Mass concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01019, swapGroup: 'rebar', layer: 'Reinforcement, 80 kg/m³' },
    ],
  },
  {
    id: 'ground-slab',
    name: 'Ground bearing slab',
    role: 'slab',
    instances: [plate(W, D, 0, 0.25)],
    solidity: 1,
    span: 'Ground bearing on compacted sub-base',
    exposure: 'Internal, damp-proof membrane below',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.99236, swapGroup: 'slab-structure', layer: 'Slab concrete' },
      { materialId: 'rebar-virgin', fraction: 0.00764, swapGroup: 'rebar', layer: 'A252 mesh plus edge bars, 60 kg/m³' },
    ],
  },
  {
    id: 'columns-ground',
    name: 'Ground floor columns',
    role: 'column',
    instances: atGrid(XS, ZS, STOREY / 2, [0.4, STOREY, 0.4]),
    solidity: 1,
    span: '4.0 m storey height, 24 no. 400 mm square',
    exposure: 'Internal, dry',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98344, swapGroup: 'frame-column', layer: 'Column concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01656, swapGroup: 'rebar', layer: 'Main bars and links, 130 kg/m³' },
    ],
  },
  {
    id: 'beams-ground',
    name: 'First floor beams',
    role: 'beam',
    instances: [
      ...beamsAlongX(ZS, STOREY - 0.3, W, [0.3, 0.6]),
      ...beamsAlongZ(XS, STOREY - 0.3, D, [0.3, 0.6]),
    ],
    solidity: 0.88,
    span: '6.0 m clear span, 300 × 600 mm downstand',
    exposure: 'Internal, dry',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98089, swapGroup: 'frame-beam', layer: 'Beam concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01911, swapGroup: 'rebar', layer: 'Tension and shear steel, 150 kg/m³' },
    ],
  },
  {
    id: 'slab-first',
    name: 'First floor slab',
    role: 'slab',
    instances: [plate(W, D, STOREY, 0.25)],
    solidity: 1,
    span: '6.0 m two-way spanning flat slab',
    exposure: 'Internal, dry',
    note: 'The largest single concrete pour in the building.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98599, swapGroup: 'slab-structure', layer: 'Slab concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01401, swapGroup: 'rebar', layer: 'Top and bottom steel, 110 kg/m³' },
    ],
  },
  {
    id: 'columns-first',
    name: 'First floor columns',
    role: 'column',
    instances: atGrid(XS, ZS, STOREY + STOREY / 2, [0.4, STOREY, 0.4]),
    solidity: 1,
    span: '4.0 m storey height, 24 no. 400 mm square',
    exposure: 'Internal, dry',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98535, swapGroup: 'frame-column', layer: 'Column concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01465, swapGroup: 'rebar', layer: 'Main bars and links, 115 kg/m³' },
    ],
  },
  {
    id: 'beams-roof',
    name: 'Roof beams',
    role: 'beam',
    instances: [
      ...beamsAlongX(ZS, STOREY * 2 - 0.3, W, [0.3, 0.55]),
      ...beamsAlongZ(XS, STOREY * 2 - 0.3, D, [0.3, 0.55]),
    ],
    solidity: 0.88,
    span: '6.0 m clear span, 300 × 550 mm downstand',
    exposure: 'Internal, dry',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98280, swapGroup: 'frame-beam', layer: 'Beam concrete' },
      { materialId: 'rebar-virgin', fraction: 0.0172, swapGroup: 'rebar', layer: 'Tension and shear steel, 135 kg/m³' },
    ],
  },
  {
    id: 'slab-roof',
    name: 'Roof slab',
    role: 'slab',
    instances: [plate(W, D, STOREY * 2, 0.22)],
    solidity: 1,
    span: '6.0 m two-way spanning',
    exposure: 'Internal below warm roof build-up',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98726, swapGroup: 'slab-structure', layer: 'Slab concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01274, swapGroup: 'rebar', layer: 'Top and bottom steel, 100 kg/m³' },
    ],
  },
  {
    id: 'stair-core',
    name: 'Stair and lift core walls',
    role: 'core-wall',
    instances: [
      { pos: [-11.4, STOREY, 6.6], size: [5.4, STOREY * 2, 0.25] },
      { pos: [-11.4, STOREY, 2.4], size: [5.4, STOREY * 2, 0.25] },
      { pos: [-14.1, STOREY, 4.5], size: [0.25, STOREY * 2, 4.2] },
    ],
    solidity: 1,
    span: 'Full height, 250 mm walls',
    exposure: 'Internal, 60 minute fire compartment',
    note: 'Also the lateral stability system, so its material is not a free choice.',
    composition: [
      { materialId: 'concrete-c3240-cem1', fraction: 0.98471, swapGroup: 'core-structure', layer: 'Wall concrete' },
      { materialId: 'rebar-virgin', fraction: 0.01529, swapGroup: 'rebar', layer: 'Vertical and horizontal steel, 120 kg/m³' },
    ],
  },
  {
    id: 'walls-external',
    name: 'External wall, outer leaf',
    role: 'wall-external',
    instances: [
      ...perimeterWalls(W, D, STOREY / 2 + 0.2, STOREY - 0.4, 0.1),
      ...perimeterWalls(W, D, STOREY + STOREY / 2 + 0.2, STOREY - 0.4, 0.1),
    ],
    solidity: 0.74,
    span: 'Infill between frame, 102.5 mm facing leaf',
    exposure: 'External, driving rain and freeze-thaw',
    note: 'Solidity allows for window and door openings cut out of the leaf.',
    composition: [{ materialId: 'brick-common', fraction: 1, swapGroup: 'wall-external-infill', layer: 'Facing brickwork' }],
  },
  {
    id: 'walls-insulation',
    name: 'External wall cavity insulation',
    role: 'insulation',
    instances: [
      ...perimeterWalls(W - 0.3, D - 0.3, STOREY / 2 + 0.2, STOREY - 0.4, 0.15),
      ...perimeterWalls(W - 0.3, D - 0.3, STOREY + STOREY / 2 + 0.2, STOREY - 0.4, 0.15),
    ],
    solidity: 0.74,
    span: '150 mm full fill cavity',
    exposure: 'Within the cavity, must tolerate incidental moisture',
    note: 'Compared at equal U-value, so a swap changes the cavity width.',
    composition: [{ materialId: 'mineral-wool', fraction: 1, swapGroup: 'insulation', layer: 'Cavity batts' }],
  },
  {
    id: 'walls-inner-leaf',
    name: 'External wall, inner leaf',
    role: 'wall-internal',
    instances: [
      ...perimeterWalls(W - 0.6, D - 0.6, STOREY / 2 + 0.2, STOREY - 0.4, 0.1),
      ...perimeterWalls(W - 0.6, D - 0.6, STOREY + STOREY / 2 + 0.2, STOREY - 0.4, 0.1),
    ],
    solidity: 0.74,
    span: '100 mm blockwork inner leaf',
    exposure: 'Internal, dry',
    composition: [{ materialId: 'block-aac', fraction: 1, swapGroup: 'wall-internal', layer: 'Blockwork' }],
  },
  {
    id: 'partitions',
    name: 'Internal partitions',
    role: 'wall-internal',
    instances: [
      { pos: [-3, STOREY / 2, 0], size: [0.1, STOREY - 0.4, D - 1] },
      { pos: [3, STOREY / 2, 0], size: [0.1, STOREY - 0.4, D - 1] },
      { pos: [9, STOREY / 2, 0], size: [0.1, STOREY - 0.4, D - 1] },
      { pos: [0, STOREY / 2, 0], size: [W - 8, STOREY - 0.4, 0.1] },
      { pos: [-3, STOREY * 1.5, 0], size: [0.1, STOREY - 0.4, D - 1] },
      { pos: [3, STOREY * 1.5, 0], size: [0.1, STOREY - 0.4, D - 1] },
      { pos: [9, STOREY * 1.5, 0], size: [0.1, STOREY - 0.4, D - 1] },
      { pos: [0, STOREY * 1.5, 0], size: [W - 8, STOREY - 0.4, 0.1] },
    ],
    solidity: 0.82,
    span: 'Consulting room and corridor separation',
    exposure: 'Internal, dry, 30 minute fire separation',
    composition: [{ materialId: 'block-aac', fraction: 1, swapGroup: 'wall-internal', layer: 'Blockwork partitions' }],
  },
  {
    id: 'glazing',
    name: 'Windows and curtain walling',
    role: 'glazing',
    instances: [
      ...glazingBand(W, D, 1.0, 1.8, 0.09),
      ...glazingBand(W, D, STOREY + 1.0, 1.8, 0.09),
      { pos: [0, 1.6, -D / 2 + 0.05], size: [7.2, 3.2, 0.1] },
    ],
    solidity: 0.15,
    span: 'Punched openings plus a glazed entrance screen',
    exposure: 'External, full weather exposure',
    composition: [
      { materialId: 'glass-igu', fraction: 0.87, swapGroup: 'glazing-glass', layer: 'Sealed units, 2 × 6 mm panes' },
      { materialId: 'aluminium-primary', fraction: 0.13, swapGroup: 'glazing-frame', layer: 'Frames and sub-frames, ~5 kg/m²' },
    ],
  },
  {
    id: 'roof-covering',
    name: 'Warm roof build-up',
    role: 'roof-covering',
    instances: [plate(W, D, STOREY * 2 + 0.22, 0.21)],
    solidity: 1,
    span: 'Flat warm roof, falls to internal outlets',
    exposure: 'Fully exposed, UV and ponding',
    composition: [
      { materialId: 'mineral-wool', fraction: 0.993, swapGroup: 'insulation', layer: '180 mm tapered insulation' },
      { materialId: 'epdm-membrane', fraction: 0.007, swapGroup: 'roof-covering', layer: 'Single ply waterproofing, 1.5 mm' },
    ],
  },
  {
    id: 'parapet',
    name: 'Roof parapet',
    role: 'wall-external',
    instances: perimeterWalls(W, D, STOREY * 2 + 0.75, 1.0, 0.2),
    solidity: 1,
    span: '1.0 m high, 200 mm thick',
    exposure: 'Fully exposed on both faces',
    composition: [{ materialId: 'brick-common', fraction: 1, swapGroup: 'wall-external-infill', layer: 'Parapet brickwork' }],
  },
  {
    id: 'entrance-canopy',
    name: 'Entrance canopy',
    role: 'roof-structure',
    instances: [
      { pos: [0, 3.9, -D / 2 - 1.6], size: [9.0, 0.25, 3.4] },
      { pos: [-3.6, 1.95, -D / 2 - 2.9], size: [0.22, 3.9, 0.22] },
      { pos: [3.6, 1.95, -D / 2 - 2.9], size: [0.22, 3.9, 0.22] },
    ],
    solidity: 0.08,
    span: '3.4 m cantilever, 9.0 m wide',
    exposure: 'External, fully exposed',
    note: 'Small in quantity but the only hot-rolled steel in the scheme.',
    composition: [{ materialId: 'steel-section-virgin', fraction: 1, swapGroup: 'frame-beam', layer: 'Hot-rolled sections' }],
  },
  {
    id: 'floor-finishes',
    name: 'Floor screeds and finishes',
    role: 'finish',
    instances: [plate(W - 0.6, D - 0.6, 0.25, 0.07), plate(W - 0.6, D - 0.6, STOREY + 0.25, 0.07)],
    solidity: 1,
    span: 'Both occupied floors',
    exposure: 'Internal, dry',
    composition: [{ materialId: 'screed-sand-cement', fraction: 1, swapGroup: 'finish-screed', layer: '70 mm screed' }],
  },
];

export const CLINIC: BuildingModel = {
  id: 'community-clinic',
  name: 'Community health clinic',
  typology: 'Two storey, RC frame',
  description:
    'Reinforced concrete frame, brick cavity walls, flat warm roof. 30 × 18 m on a 6 m grid.',
  aiContext:
    'Two-storey community health clinic, 30 × 18 m on a 6 m structural grid, 4.0 m storey heights, 1080 m² GFA. In-situ reinforced concrete frame with 400 mm square columns, 300 × 600 mm downstand beams and 250 mm two-way flat slabs on pad foundations. Brick and blockwork cavity external walls with full-fill mineral wool, AAC block partitions, aluminium-framed double glazing, flat warm roof with tapered insulation and single ply membrane. An RC stair and lift core at the west end provides all lateral stability. Low-rise, non-residential, 60 minute fire resistance to the core and 30 minutes elsewhere.',
  grossFloorAreaM2: 1080,
  storeys: 2,
  siteSize: 56,
  elements,
  source: 'parametric',
};
