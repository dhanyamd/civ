import { material } from '@/data/materials';
import { SWAP_GROUPS, type SwapGroup } from '@/data/swapRules';
import type {
  BimElement,
  BuildingModel,
  BuildingTotals,
  ElementQuantity,
  MaterialQuantity,
  Substitution,
} from '@/types/studio';

/** Gross volume of the boxes drawn for this element, m³. */
export function grossVolume(element: BimElement): number {
  return element.instances.reduce((sum, i) => sum + i.size[0] * i.size[1] * i.size[2], 0);
}

/**
 * Quantify one element. Geometry is the single source of truth: net volume is
 * the drawn box volume scaled by the element's solidity, then split by the
 * composition fractions. Nothing here is typed in by hand twice, so the figures
 * on screen cannot drift away from the model you are looking at.
 */
export function quantifyElement(element: BimElement, totalCarbon = 0): ElementQuantity {
  const gross = grossVolume(element);
  const net = gross * element.solidity;

  const materials: MaterialQuantity[] = element.composition.map((part) => {
    const spec = material(part.materialId);
    const volumeM3 = net * part.fraction;
    const massKg = volumeM3 * spec.densityKgM3;
    return {
      material: spec,
      volumeM3,
      massKg,
      carbonKg: massKg * spec.carbonPerKg,
      biogenicKg: massKg * (spec.biogenicPerKg ?? 0),
      costUsd: massKg * spec.costPerKgUsd,
    };
  });

  const sum = (pick: (m: MaterialQuantity) => number) => materials.reduce((a, m) => a + pick(m), 0);
  const carbonKg = sum((m) => m.carbonKg);

  return {
    element,
    count: element.instances.length,
    grossVolumeM3: gross,
    netVolumeM3: net,
    massKg: sum((m) => m.massKg),
    carbonKg,
    biogenicKg: sum((m) => m.biogenicKg),
    costUsd: sum((m) => m.costUsd),
    materials,
    carbonShare: totalCarbon > 0 ? carbonKg / totalCarbon : 0,
  };
}

/** Whole-building rollup, with each element's share of the total. */
export function quantifyBuilding(building: BuildingModel): BuildingTotals {
  const first = building.elements.map((e) => quantifyElement(e));
  const carbonKg = first.reduce((a, e) => a + e.carbonKg, 0);

  const elements = first
    .map((e) => ({ ...e, carbonShare: carbonKg > 0 ? e.carbonKg / carbonKg : 0 }))
    .sort((a, b) => b.carbonKg - a.carbonKg);

  return {
    carbonKg,
    biogenicKg: first.reduce((a, e) => a + e.biogenicKg, 0),
    costUsd: first.reduce((a, e) => a + e.costUsd, 0),
    massKg: first.reduce((a, e) => a + e.massKg, 0),
    elements,
    carbonPerM2: building.grossFloorAreaM2 > 0 ? carbonKg / building.grossFloorAreaM2 : 0,
  };
}

/**
 * Candidate substitutions for one material inside one element, with the
 * deltas already worked out.
 *
 * Each candidate is resized for equal structural or thermal duty before its
 * mass is computed, so a lighter material does not get credit it has not
 * earned. Results are ranked by carbon saved and infeasible-by-role options
 * never enter the list.
 */
export function substitutionsFor(
  elementQ: ElementQuantity,
  currentMaterialId: string,
  buildingCarbonKg: number,
  /**
   * When true, only materials whose factor comes from a published EPD are
   * offered. This is the default: an alternative you cannot evidence is not
   * much use in a carbon assessment. Emerging products such as mycelium or
   * geopolymer have no EPD yet, which is itself worth seeing.
   */
  epdOnly = true,
): SubstitutionWithSizing[] {
  const element = elementQ.element;
  const part = element.composition.find((p) => p.materialId === currentMaterialId);
  const currentQ = elementQ.materials.find((m) => m.material.id === currentMaterialId);
  if (!part || !currentQ) return [];

  const pool = SWAP_GROUPS[part.swapGroup as SwapGroup] ?? [];

  return pool
    .filter((id) => id !== currentMaterialId)
    .filter((id) => !epdOnly || material(id).dataQuality === 'epd')
    .map((id) => {
      const to = material(id);
      // Compared at the same volume this element already occupies. One stated
      // assumption, no invented resize factors — if the substitute would really
      // need a bigger section, the review says so in plain words.
      const volumeM3 = currentQ.volumeM3;
      const massKg = volumeM3 * to.densityKgM3;
      const carbonKg = massKg * to.carbonPerKg;
      const costUsd = massKg * to.costPerKgUsd;
      const carbonDeltaKg = carbonKg - currentQ.carbonKg;
      const costDeltaUsd = costUsd - currentQ.costUsd;

      return {
        id,
        material: to,
        replacesId: currentMaterialId,
        volumeM3,
        massKg,
        carbonKg,
        biogenicKg: massKg * (to.biogenicPerKg ?? 0),
        costUsd,
        carbonDeltaKg,
        carbonDeltaPct: currentQ.carbonKg > 0 ? (carbonDeltaKg / currentQ.carbonKg) * 100 : 0,
        costDeltaUsd,
        costDeltaPct: currentQ.costUsd > 0 ? (costDeltaUsd / currentQ.costUsd) * 100 : 0,
        buildingSharePct: buildingCarbonKg > 0 ? (-carbonDeltaKg / buildingCarbonKg) * 100 : 0,
      };
    })
    .sort((a, b) => a.carbonDeltaKg - b.carbonDeltaKg);
}

/** Kept as a named alias because the components import it by this name. */
export type SubstitutionWithSizing = Substitution;

/**
 * Signed-tetrahedron volume of an arbitrary mesh, in world space, m³.
 *
 * Used for uploaded and downloaded glTF files, where there is no schedule to
 * read quantities from. Only valid for closed geometry, so the caller sanity
 * checks the answer against the bounding box before trusting it.
 */
export function meshVolume(
  position: ArrayLike<number>,
  index: ArrayLike<number> | null,
  transform: (out: [number, number, number], i: number) => void,
): number {
  const a: [number, number, number] = [0, 0, 0];
  const b: [number, number, number] = [0, 0, 0];
  const c: [number, number, number] = [0, 0, 0];
  let total = 0;

  const triangles = index ? index.length / 3 : position.length / 9;
  for (let t = 0; t < triangles; t += 1) {
    const i0 = index ? index[t * 3] : t * 3;
    const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
    const i2 = index ? index[t * 3 + 2] : t * 3 + 2;
    transform(a, i0);
    transform(b, i1);
    transform(c, i2);
    total +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return Math.abs(total) / 6;
}
