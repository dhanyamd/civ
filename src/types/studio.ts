/** Where an element sits in the load path / envelope. Governs valid substitutions. */
export type ElementRole =
  | 'foundation'
  | 'column'
  | 'beam'
  | 'slab'
  | 'core-wall'
  | 'wall-external'
  | 'wall-internal'
  | 'roof-structure'
  | 'roof-covering'
  | 'glazing'
  | 'cladding'
  | 'insulation'
  | 'finish'
  | 'stair'
  | 'misc';

export const ROLE_LABEL: Record<ElementRole, string> = {
  foundation: 'Foundation',
  column: 'Column',
  beam: 'Beam',
  slab: 'Floor slab',
  'core-wall': 'Shear / core wall',
  'wall-external': 'External wall',
  'wall-internal': 'Internal wall',
  'roof-structure': 'Roof structure',
  'roof-covering': 'Roof covering',
  glazing: 'Glazing',
  cladding: 'Cladding',
  insulation: 'Insulation',
  finish: 'Finish',
  stair: 'Stair',
  misc: 'Other',
};

export type MaterialFamily =
  | 'steel'
  | 'concrete'
  | 'timber'
  | 'bamboo'
  | 'masonry'
  | 'earth'
  | 'glass'
  | 'metal'
  | 'insulation'
  | 'stone'
  | 'membrane'
  | 'finish';

/**
 * One material with its cradle-to-gate impact.
 *
 * `carbonPerKg` is A1–A3 only (product stage), which is the scope students and
 * assessors compare on. `biogenicPerKg` is carbon stored in the material and is
 * reported separately — never netted off silently, because it is only a real
 * saving if the product is not burnt or landfilled at end of life.
 */
export interface MaterialSpec {
  id: string;
  name: string;
  short: string;
  family: MaterialFamily;
  /** kg/m³ */
  densityKgM3: number;
  /** kgCO2e per kg, cradle-to-gate A1–A3 */
  carbonPerKg: number;
  /** kgCO2e per kg of sequestered biogenic carbon (negative = stored) */
  biogenicPerKg?: number;
  /** indicative supply-and-fix cost, USD per kg */
  costPerKgUsd: number;
  /** roles this material can legitimately serve */
  roles: ElementRole[];
  /** provenance of the carbon figure */
  source: string;
  /** render colour when the model is drawn from material data */
  colour: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  /** true for the conventional high-impact baseline options */
  conventional?: boolean;
  note?: string;
  /** health, toxicity and pollution concerns beyond the carbon figure */
  hazards?: string[];
  /** emerging products with thin EPD coverage or limited code acceptance */
  emerging?: boolean;
  /**
   * Whether the carbon figure comes from a published EPD or is an industry
   * estimate. Shown in the UI — an estimate is useful for a first comparison
   * but must not be passed off as measured data.
   */
  dataQuality: 'epd' | 'estimate';
  /** the EPD this material's figure was taken from, when there is one */
  epd?: EpdRecord;
  /** recycled content assumed in the figure above, 0–1 */
  recycledContent?: number;
}

/** One imported Environmental Product Declaration. See scripts/fetch-epds.mjs. */
export interface EpdRecord {
  materialId: string;
  epdName: string;
  uuid: string;
  url: string;
  basis: string;
  gwpFossilA1A3: number | null;
  gwpBiogenicA1A3: number | null;
  gwpTotalA1A3: number | null;
  declaredAmount: number;
  declaredUnit: string;
  declaredMassKg: number;
  densityKgM3: number | null;
  carbonPerKg: number;
  biogenicPerKg: number | null;
  refYear: number | null;
  validUntil: number | null;
  subType: string | null;
  compliance: string[];
}

/** A box instance in metres. Geometry doubles as the quantity take-off. */
export interface Instance {
  pos: [number, number, number];
  size: [number, number, number];
  /** rotation about Y, radians — plan rotation */
  rotY?: number;
  /** rotation about X, radians — used to pitch roof members */
  rotX?: number;
  /** rotation about Z, radians */
  rotZ?: number;
}

/** How an element's net material volume splits between materials, by volume fraction. */
export interface CompositionPart {
  materialId: string;
  fraction: number;
  /** which pool of substitutes applies to this part — see data/swapRules.ts */
  swapGroup: SwapGroupName;
  /** what this part does inside the element, shown in the panel */
  layer?: string;
}

/** Kept loose here to avoid a circular import with data/swapRules.ts. */
export type SwapGroupName = string;

/**
 * A scheduled building element, in the sense a BIM schedule means it: one row
 * covering every instance of the same thing, with a real material breakdown.
 */
export interface BimElement {
  id: string;
  name: string;
  role: ElementRole;
  /** gross boxes drawn in the scene */
  instances: Instance[];
  /**
   * Net material volume as a fraction of the gross box volume. A 305×305 UC
   * drawn as a 0.3 m box is only ~17% steel; a cavity wall is not solid brick.
   */
  solidity: number;
  composition: CompositionPart[];
  span?: string;
  exposure?: string;
  note?: string;
}

export interface BuildingModel {
  id: string;
  name: string;
  typology: string;
  description: string;
  /** context handed to the model so its advice fits this building */
  aiContext: string;
  grossFloorAreaM2: number;
  storeys: number;
  elements: BimElement[];
  /** ground plane size for the scene, metres */
  siteSize?: number;
  source: 'parametric';
}

/** A library entry that is a downloaded/uploaded glTF file rather than a parametric model. */
export interface GltfModelEntry {
  id: string;
  name: string;
  typology: string;
  description: string;
  aiContext: string;
  url: string;
  meta: string;
  credit?: string;
  source: 'gltf';
  /** uploaded files are revoked on replace */
  objectUrl?: boolean;
}

export type LibraryEntry = BuildingModel | GltfModelEntry;

/* ---------- computed quantities ---------- */

export interface MaterialQuantity {
  material: MaterialSpec;
  volumeM3: number;
  massKg: number;
  /** kgCO2e, A1–A3 */
  carbonKg: number;
  biogenicKg: number;
  costUsd: number;
}

export interface ElementQuantity {
  element: BimElement;
  count: number;
  grossVolumeM3: number;
  netVolumeM3: number;
  massKg: number;
  carbonKg: number;
  biogenicKg: number;
  costUsd: number;
  materials: MaterialQuantity[];
  /** share of whole-building A1–A3 carbon, 0–1 */
  carbonShare: number;
}

export interface BuildingTotals {
  carbonKg: number;
  biogenicKg: number;
  costUsd: number;
  massKg: number;
  elements: ElementQuantity[];
  /** kgCO2e per m² GFA — the number a carbon assessment is judged on */
  carbonPerM2: number;
}

/** One candidate substitution with its deterministic deltas. */
export interface Substitution {
  id: string;
  material: MaterialSpec;
  /** replaces this material within the element */
  replacesId: string;
  volumeM3: number;
  massKg: number;
  carbonKg: number;
  biogenicKg: number;
  costUsd: number;
  carbonDeltaKg: number;
  carbonDeltaPct: number;
  costDeltaUsd: number;
  costDeltaPct: number;
  /** saving as a share of whole-building carbon, 0–1 */
  buildingSharePct: number;
}

/* ---------- AI payloads ---------- */

export interface MaterialProfile {
  description: string;
  disadvantages: string[];
  model?: string;
}

/** An alternative material proposed by the model, with its own estimates. */
export interface ReviewedOption {
  id: string;
  name: string;
  description: string;
  advantages: string[];
  /** the model's estimate, not a measured figure — negative means lower */
  carbonDeltaPct: number | null;
  costDeltaPct: number | null;
  caution: string;
}

export interface SubstitutionReview {
  options: ReviewedOption[];
  model?: string;
}

/** A material swap the user has accepted, tracked for the building rollup. */
export interface AcceptedSwap {
  elementId: string;
  elementName: string;
  fromMaterialId: string;
  toMaterialId: string;
  carbonDeltaKg: number;
  costDeltaUsd: number;
}

/** Selection coming out of the 3D viewer. */
export interface ViewerSelection {
  kind: 'element' | 'mesh' | 'ifc';
  /** parametric element id, glTF part name, or IFC express id */
  key: string;
  label: string;
  /** glTF-only: visual material names read off the file */
  visualMaterials?: { name: string; colour: string }[];
  meshVolumeM3?: number;
}
