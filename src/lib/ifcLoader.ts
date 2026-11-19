import * as THREE from 'three';
import { IfcAPI, IFCRELASSOCIATESMATERIAL } from 'web-ifc';

/**
 * Loads an IFC building model and pulls out what glTF cannot carry: the real
 * material each element was specified with, as authored by whoever modelled it.
 *
 * An IFC file holds `IFCMATERIAL('Masonry - Brick')`,
 * `IFCMATERIAL('Metal - Steel - 345 MPa')` and so on, associated to elements
 * through `IfcRelAssociatesMaterial`. That is real industrial data, not
 * anything this app invented, which is the whole reason for supporting it.
 */

export interface IfcElement {
  /** IFC express id */
  id: number;
  name: string;
  /** IFC entity type, e.g. IFCWALLSTANDARDCASE */
  ifcType: string;
  /** material names exactly as written in the file */
  materials: string[];
  volumeM3?: number;
}

export interface LoadedIfc {
  root: THREE.Group;
  elements: Map<number, IfcElement>;
  /** every distinct material name in the file */
  materialNames: string[];
  dispose: () => void;
}

/** web-ifc ships its wasm next to the package; Vite serves it from node_modules. */
const WASM_PATH = 'https://unpkg.com/web-ifc@0.0.78/';

let api: IfcAPI | null = null;

async function getApi(): Promise<IfcAPI> {
  if (api) return api;
  const instance = new IfcAPI();
  instance.SetWasmPath(WASM_PATH);
  await instance.Init();
  api = instance;
  return instance;
}

function decodeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value: unknown }).value;
    if (typeof inner === 'string') return inner;
  }
  return '';
}

/**
 * Walk every material-association relationship and build element → material
 * names. IFC nests materials several ways (single, layer set, list, profile
 * set), so each shape is handled rather than assuming one.
 */
function readMaterials(ifc: IfcAPI, modelId: number): Map<number, string[]> {
  const byElement = new Map<number, string[]>();

  const collectNames = (relating: unknown, out: Set<string>, depth = 0) => {
    if (!relating || depth > 6) return;
    const node = relating as Record<string, unknown>;

    const direct = decodeString(node.Name);
    if (direct) out.add(direct);

    for (const key of [
      'ForLayerSet',
      'MaterialLayers',
      'Materials',
      'MaterialConstituents',
      'MaterialProfiles',
      'Material',
    ]) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach((c) => collectNames(c, out, depth + 1));
      else if (child) collectNames(child, out, depth + 1);
    }
  };

  const rels = ifc.GetLineIDsWithType(modelId, IFCRELASSOCIATESMATERIAL);
  for (let i = 0; i < rels.size(); i += 1) {
    let rel: Record<string, unknown>;
    try {
      rel = ifc.GetLine(modelId, rels.get(i), true) as Record<string, unknown>;
    } catch {
      continue;
    }

    const names = new Set<string>();
    collectNames(rel.RelatingMaterial, names);
    if (!names.size) continue;

    const objects = rel.RelatedObjects;
    if (!Array.isArray(objects)) continue;
    for (const obj of objects) {
      const expressId = (obj as { expressID?: number })?.expressID;
      if (typeof expressId !== 'number') continue;
      const existing = byElement.get(expressId) ?? [];
      byElement.set(expressId, [...new Set([...existing, ...names])]);
    }
  }

  return byElement;
}

/** Geometry for one express id, already in world placement. */
function meshesFor(
  ifc: IfcAPI,
  modelId: number,
  placedGeometries: { geometryExpressID: number; flatTransformation: number[]; color: { x: number; y: number; z: number; w: number } }[],
): { geometry: THREE.BufferGeometry; colour: THREE.Color; opacity: number }[] {
  const out: { geometry: THREE.BufferGeometry; colour: THREE.Color; opacity: number }[] = [];

  for (const placed of placedGeometries) {
    const geom = ifc.GetGeometry(modelId, placed.geometryExpressID);
    const verts = ifc.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
    const indices = ifc.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());

    // web-ifc interleaves position(3) + normal(3).
    const count = verts.length / 6;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      position[i * 3] = verts[i * 6];
      position[i * 3 + 1] = verts[i * 6 + 1];
      position[i * 3 + 2] = verts[i * 6 + 2];
      normal[i * 3] = verts[i * 6 + 3];
      normal[i * 3 + 1] = verts[i * 6 + 4];
      normal[i * 3 + 2] = verts[i * 6 + 5];
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(position, 3));
    buffer.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    buffer.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    buffer.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation));

    out.push({
      geometry: buffer,
      colour: new THREE.Color(placed.color.x, placed.color.y, placed.color.z),
      opacity: placed.color.w,
    });
    geom.delete();
  }

  return out;
}

export async function loadIfc(
  data: ArrayBuffer,
  onProgress?: (message: string) => void,
): Promise<LoadedIfc> {
  onProgress?.('Starting IFC engine');
  const ifc = await getApi();

  onProgress?.('Parsing IFC');
  const modelId = ifc.OpenModel(new Uint8Array(data), {
    COORDINATE_TO_ORIGIN: true,
  });

  onProgress?.('Reading material associations');
  const materialsByElement = readMaterials(ifc, modelId);

  onProgress?.('Building geometry');
  const root = new THREE.Group();
  root.name = 'ifc-model';
  const elements = new Map<number, IfcElement>();
  const owned: (THREE.BufferGeometry | THREE.Material)[] = [];
  const allMaterialNames = new Set<string>();

  ifc.StreamAllMeshes(modelId, (mesh) => {
    const expressId = mesh.expressID;
    const placed = mesh.geometries;
    const list: { geometryExpressID: number; flatTransformation: number[]; color: { x: number; y: number; z: number; w: number } }[] = [];
    for (let i = 0; i < placed.size(); i += 1) list.push(placed.get(i));

    const parts = meshesFor(ifc, modelId, list);
    if (!parts.length) return;

    let name = '';
    let ifcType = '';
    try {
      const line = ifc.GetLine(modelId, expressId, false) as Record<string, unknown>;
      name = decodeString(line.Name);
      ifcType = String(ifc.GetNameFromTypeCode(line.type as number) ?? '');
    } catch {
      /* some entities have no readable header; the geometry is still usable */
    }

    const materials = materialsByElement.get(expressId) ?? [];
    materials.forEach((m) => allMaterialNames.add(m));

    const group = new THREE.Group();
    group.name = name || ifcType || `Element ${expressId}`;
    for (const part of parts) {
      const material = new THREE.MeshStandardMaterial({
        color: part.colour,
        roughness: 0.85,
        metalness: 0.03,
        side: THREE.DoubleSide,
      });
      if (part.opacity < 1) {
        material.transparent = true;
        material.opacity = part.opacity;
        material.depthWrite = false;
      }
      const threeMesh = new THREE.Mesh(part.geometry, material);
      threeMesh.castShadow = true;
      threeMesh.receiveShadow = true;
      threeMesh.userData.ifcId = expressId;
      group.add(threeMesh);
      owned.push(part.geometry, material);
    }
    group.userData.ifcId = expressId;
    root.add(group);

    elements.set(expressId, {
      id: expressId,
      name: group.name,
      ifcType,
      materials,
    });
  });

  ifc.CloseModel(modelId);

  // IFC is Z-up; three.js is Y-up.
  root.rotation.x = -Math.PI / 2;

  return {
    root,
    elements,
    materialNames: [...allMaterialNames].sort(),
    dispose: () => {
      owned.forEach((o) => o.dispose());
      root.clear();
    },
  };
}
