import type { Instance } from '@/types/studio';

/** Evenly spaced grid line positions centred on zero, for `bays` bays of `spacing`. */
export function gridLines(bays: number, spacing: number): number[] {
  const span = bays * spacing;
  return Array.from({ length: bays + 1 }, (_, i) => -span / 2 + i * spacing);
}

/** A column-like box at every intersection of two grid-line sets. */
export function atGrid(
  xs: number[],
  zs: number[],
  y: number,
  size: [number, number, number],
): Instance[] {
  return xs.flatMap((x) => zs.map((z) => ({ pos: [x, y, z] as [number, number, number], size })));
}

/** A run of beams along X, one per z grid line, spanning the full width. */
export function beamsAlongX(
  zs: number[],
  y: number,
  length: number,
  section: [number, number],
  x = 0,
): Instance[] {
  return zs.map((z) => ({
    pos: [x, y, z] as [number, number, number],
    size: [length, section[1], section[0]] as [number, number, number],
  }));
}

/** A run of beams along Z, one per x grid line, spanning the full depth. */
export function beamsAlongZ(
  xs: number[],
  y: number,
  length: number,
  section: [number, number],
  z = 0,
): Instance[] {
  return xs.map((x) => ({
    pos: [x, y, z] as [number, number, number],
    size: [section[0], section[1], length] as [number, number, number],
  }));
}

/** The four walls of a rectangular perimeter, as boxes of given thickness and height. */
export function perimeterWalls(
  width: number,
  depth: number,
  y: number,
  height: number,
  thickness: number,
): Instance[] {
  const t = thickness;
  return [
    { pos: [0, y, -depth / 2 + t / 2], size: [width, height, t] },
    { pos: [0, y, depth / 2 - t / 2], size: [width, height, t] },
    { pos: [-width / 2 + t / 2, y, 0], size: [t, height, depth - 2 * t] },
    { pos: [width / 2 - t / 2, y, 0], size: [t, height, depth - 2 * t] },
  ];
}

/** A horizontal plate, e.g. a slab or a roof deck. */
export function plate(
  width: number,
  depth: number,
  y: number,
  thickness: number,
  x = 0,
  z = 0,
): Instance {
  return { pos: [x, y + thickness / 2, z], size: [width, thickness, depth] };
}

/** Repeat a set of instances once per storey. */
export function perStorey(storeys: number, storeyHeight: number, base: number, make: (y: number, level: number) => Instance[]): Instance[] {
  return Array.from({ length: storeys }, (_, level) => make(base + level * storeyHeight, level)).flat();
}

/** A band of glazing running around a perimeter at a given sill height. */
export function glazingBand(
  width: number,
  depth: number,
  sill: number,
  height: number,
  thickness: number,
  inset = 0,
): Instance[] {
  const w = width - inset * 2;
  const d = depth - inset * 2;
  const y = sill + height / 2;
  return [
    { pos: [0, y, -d / 2], size: [w * 0.88, height, thickness] },
    { pos: [0, y, d / 2], size: [w * 0.88, height, thickness] },
    { pos: [-w / 2, y, 0], size: [thickness, height, d * 0.82] },
    { pos: [w / 2, y, 0], size: [thickness, height, d * 0.82] },
  ];
}
