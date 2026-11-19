import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingModel, ElementQuantity, MaterialSpec } from '@/types/studio';

/**
 * Builds the scene from the same element schedule the quantities come from.
 *
 * One merged mesh per scheduled element: a click returns the whole element the
 * way a BIM schedule row does, rather than one of the twenty-four identical
 * columns that element represents. It also keeps the draw-call count to the
 * number of elements, so an eight-storey frame with 1,500 boxes stays smooth.
 */

export interface BuiltScene {
  root: THREE.Group;
  /** elementId -> its mesh */
  meshes: Map<string, THREE.Mesh>;
  dispose: () => void;
}

/** The material that dominates an element by volume decides how it looks. */
function dominantMaterial(q: ElementQuantity): MaterialSpec {
  return q.materials.reduce((best, m) => (m.volumeM3 > best.volumeM3 ? m : best), q.materials[0]).material;
}

function appearanceFor(spec: MaterialSpec): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.colour),
    roughness: spec.roughness ?? 0.85,
    metalness: spec.metalness ?? 0.05,
  });
  if (spec.opacity != null && spec.opacity < 1) {
    mat.transparent = true;
    mat.opacity = spec.opacity;
    mat.depthWrite = false;
  }
  return mat;
}

/** Red-to-green ramp over an element's share of total building carbon. */
export function hotspotColour(share: number): THREE.Color {
  // Shares are heavily skewed, so compress with a root to keep the ramp useful.
  const t = Math.min(1, Math.sqrt(share / 0.3));
  const cold = new THREE.Color('#d6d3d1');
  const warm = new THREE.Color('#f59e0b');
  const hot = new THREE.Color('#be123c');
  return t < 0.5
    ? cold.clone().lerp(warm, t / 0.5)
    : warm.clone().lerp(hot, (t - 0.5) / 0.5);
}

export type ViewMode = 'materials' | 'hotspots';

export function buildBuildingScene(
  building: BuildingModel,
  quantities: ElementQuantity[],
  mode: ViewMode,
): BuiltScene {
  const root = new THREE.Group();
  root.name = building.id;
  const meshes = new Map<string, THREE.Mesh>();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];

  const byId = new Map(quantities.map((q) => [q.element.id, q]));

  for (const element of building.elements) {
    const q = byId.get(element.id);
    if (!q) continue;

    const boxes: THREE.BufferGeometry[] = [];
    for (const instance of element.instances) {
      const [w, h, d] = instance.size;
      if (w <= 0 || h <= 0 || d <= 0) continue;
      const geom = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4();
      const euler = new THREE.Euler(instance.rotX ?? 0, instance.rotY ?? 0, instance.rotZ ?? 0);
      m.makeRotationFromEuler(euler);
      m.setPosition(instance.pos[0], instance.pos[1], instance.pos[2]);
      geom.applyMatrix4(m);
      boxes.push(geom);
    }
    if (!boxes.length) continue;

    const merged = mergeGeometries(boxes, false);
    boxes.forEach((b) => b.dispose());
    if (!merged) continue;
    merged.computeVertexNormals();

    const spec = dominantMaterial(q);
    const appearance =
      mode === 'materials'
        ? appearanceFor(spec)
        : new THREE.MeshStandardMaterial({
            color: hotspotColour(q.carbonShare),
            roughness: 0.75,
            metalness: 0.02,
          });

    const mesh = new THREE.Mesh(merged, appearance);
    mesh.name = element.name;
    mesh.userData.elementId = element.id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    root.add(mesh);
    meshes.set(element.id, mesh);
    owned.push(merged, appearance);
  }

  return {
    root,
    meshes,
    dispose: () => {
      owned.forEach((o) => o.dispose());
      root.clear();
    },
  };
}

/** Flat ground plane sized to the building, so it reads as sitting on a site. */
export function buildGround(size: number): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(size, size);
  geom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#d9d6d1', roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.y = -0.02;
  mesh.receiveShadow = true;
  mesh.userData.isGround = true;
  return mesh;
}
