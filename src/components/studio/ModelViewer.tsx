import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { buildBuildingScene, buildGround, type ViewMode } from '@/lib/sceneBuilder';
import type { LoadedIfc } from '@/lib/ifcLoader';
import { meshVolume } from '@/lib/quantities';
import type { BuildingModel, ElementQuantity, ViewerSelection } from '@/types/studio';

const CLICK_TOLERANCE_PX = 6;
const HIGHLIGHT = new THREE.Color('#059669');

type Status = 'loading' | 'ready' | 'error';

interface Props {
  /** exactly one source is set */
  building?: BuildingModel;
  quantities?: ElementQuantity[];
  gltfUrl?: string;
  ifcUrl?: string;
  viewMode: ViewMode;
  selectedKey: string | null;
  onSelect: (selection: ViewerSelection | null) => void;
  /** fired once an IFC model is parsed, with its real element/material table */
  onIfcLoaded?: (ifc: LoadedIfc | null) => void;
}

/** Walk up the tree to the first named ancestor — glTF leaf meshes are often unnamed. */
function partNameOf(object: THREE.Object3D): string {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name) return current.name;
    current = current.parent;
  }
  return 'Unnamed part';
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function allMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !child.userData.isGround) out.push(child as THREE.Mesh);
  });
  return out;
}

/** Approximate volume of one glTF mesh in world space, m³, or undefined if implausible. */
function approximateVolume(mesh: THREE.Mesh): number | undefined {
  const geom = mesh.geometry;
  const pos = geom.getAttribute('position');
  if (!pos) return undefined;
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld;
  const v = new THREE.Vector3();

  const volume = meshVolume(
    pos.array as ArrayLike<number>,
    geom.index ? (geom.index.array as ArrayLike<number>) : null,
    (out, i) => {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      out[0] = v.x;
      out[1] = v.y;
      out[2] = v.z;
    },
  );

  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return undefined;
  const size = bb.getSize(new THREE.Vector3()).applyMatrix4(
    new THREE.Matrix4().extractRotation(matrix),
  );
  const bboxVolume = Math.abs(size.x * size.y * size.z);
  // Open or self-intersecting geometry gives nonsense; reject rather than mislead.
  if (!Number.isFinite(volume) || volume <= 0) return undefined;
  if (bboxVolume > 0 && volume > bboxVolume * 1.05) return undefined;
  return volume;
}

function frameCamera(root: THREE.Object3D, camera: THREE.PerspectiveCamera, controls: OrbitControls) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) || 1;

  camera.near = Math.max(0.05, radius / 200);
  camera.far = radius * 60;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  camera.position.set(center.x + radius * 0.95, center.y + radius * 0.62, center.z + radius * 1.15);
  controls.minDistance = radius * 0.25;
  controls.maxDistance = radius * 5;
  controls.update();
}

export function ModelViewer({
  building,
  quantities,
  gltfUrl,
  ifcUrl,
  viewMode,
  selectedKey,
  onSelect,
  onIfcLoaded,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const contentRef = useRef<THREE.Object3D | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const onSelectRef = useRef(onSelect);
  const onIfcLoadedRef = useRef(onIfcLoaded);
  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  useEffect(() => {
    onSelectRef.current = onSelect;
    onIfcLoadedRef.current = onIfcLoaded;
  }, [onSelect, onIfcLoaded]);

  // Rebuilding the merged geometry is only necessary when the model or the
  // colouring mode changes, not on every selection.
  const sceneKey = building
    ? `${building.id}:${viewMode}`
    : ifcUrl
      ? `ifc:${ifcUrl}`
      : `gltf:${gltfUrl ?? ''}`;

  /* ---------- renderer, lights, controls: created once ---------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cursor = 'pointer';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b3ab, 2.1));
    const sun = new THREE.DirectionalLight(0xfff6e8, 2.0);
    sun.position.set(60, 90, 45);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 70;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdce6f0, 0.5);
    fill.position.set(-50, 30, -40);
    scene.add(fill);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      // updateStyle must stay on: with devicePixelRatio 2 the drawing buffer is
      // twice the CSS size, and without the style the canvas lays out at buffer
      // size and bursts out of its container.
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    /* ---------- picking: distinguish a click from an orbit drag ---------- */
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let downAt: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const start = downAt;
      downAt = null;
      const content = contentRef.current;
      if (!start || !content) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_TOLERANCE_PX) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);

      const hit = raycaster
        .intersectObject(content, true)
        .find((i) => !i.object.userData.isGround);

      if (!hit) {
        onSelectRef.current(null);
        return;
      }

      const mesh = hit.object as THREE.Mesh;
      const elementId = mesh.userData.elementId as string | undefined;

      if (elementId) {
        onSelectRef.current({ kind: 'element', key: elementId, label: mesh.name });
        return;
      }

      // IFC: report the express id so the panel can read the file's own
      // material association for this element.
      const ifcId = mesh.userData.ifcId as number | undefined;
      if (typeof ifcId === 'number') {
        onSelectRef.current({
          kind: 'ifc',
          key: String(ifcId),
          label: partNameOf(mesh),
          meshVolumeM3: approximateVolume(mesh),
        });
        return;
      }

      // glTF file: report the part name and whatever visual materials it carries.
      const name = partNameOf(mesh);
      const visualMaterials = materialsOf(mesh).map((m) => ({
        name: m.name || 'Unnamed material',
        colour:
          m instanceof THREE.MeshStandardMaterial
            ? `#${m.color.getHexString()}`
            : '#a8a29e',
      }));
      onSelectRef.current({
        kind: 'mesh',
        key: `${name}::${visualMaterials.map((v) => v.name).join('|')}`,
        label: name,
        visualMaterials,
        meshVolumeM3: approximateVolume(mesh),
      });
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  /* ---------- swap in the model whenever the library selection changes ---------- */
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const mount = (content: THREE.Object3D, groundSize: number | null, extra?: () => void) => {
      scene.add(content);
      contentRef.current = content;
      // Frame on the building alone — adding the ground first would make the
      // site plane set the bounding box and push the camera miles out.
      frameCamera(content, camera, controls);
      if (groundSize) content.add(buildGround(groundSize));
      setStatus('ready');
      cleanup = () => {
        scene.remove(content);
        contentRef.current = null;
        extra?.();
      };
    };

    setStatus('loading');
    setProgress(0);

    if (building && quantities) {
      const built = buildBuildingScene(building, quantities, viewMode);
      mount(built.root, building.siteSize ?? 60, () => built.dispose());
    } else if (ifcUrl) {
      setStage('Downloading IFC');
      (async () => {
        const res = await fetch(ifcUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get('content-length') ?? 0);
        if (total > 0) setProgress(0);
        const data = await res.arrayBuffer();
        if (cancelled) return null;
        const { loadIfc } = await import('@/lib/ifcLoader');
        return loadIfc(data, setStage);
      })()
        .then((loaded) => {
          if (cancelled || !loaded) return;
          onIfcLoadedRef.current?.(loaded);
          mount(loaded.root, null, () => {
            loaded.dispose();
            onIfcLoadedRef.current?.(null);
          });
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
    } else if (gltfUrl) {
      const loader = new GLTFLoader();
      loader.load(
        gltfUrl,
        (gltf) => {
          if (cancelled) return;
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          mount(gltf.scene, null, () => {
            for (const mesh of allMeshes(gltf.scene)) {
              mesh.geometry.dispose();
              materialsOf(mesh).forEach((m) => m.dispose());
            }
          });
        },
        (e) => {
          if (e.total > 0) setProgress(Math.round((e.loaded / e.total) * 100));
        },
        () => {
          if (!cancelled) setStatus('error');
        },
      );
    }

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // quantities is derived from building, so building+viewMode is the real key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  /* ---------- highlight the current selection ---------- */
  useEffect(() => {
    const content = contentRef.current;
    if (status !== 'ready' || !content || !selectedKey) return;

    const targets: THREE.Mesh[] = [];
    if (building) {
      for (const mesh of allMeshes(content)) {
        if (mesh.userData.elementId === selectedKey) targets.push(mesh);
      }
    } else if (ifcUrl) {
      for (const mesh of allMeshes(content)) {
        if (String(mesh.userData.ifcId) === selectedKey) targets.push(mesh);
      }
    } else {
      const name = selectedKey.split('::')[0];
      for (const mesh of allMeshes(content)) {
        if (partNameOf(mesh) === name) targets.push(mesh);
      }
    }
    if (!targets.length) return;

    const restore = targets.map((mesh) => {
      const original = mesh.material;
      const clones = materialsOf(mesh).map((m) => {
        const clone = m.clone();
        if (clone instanceof THREE.MeshStandardMaterial) {
          clone.emissive.copy(HIGHLIGHT);
          clone.emissiveIntensity = 0.55;
        }
        return clone;
      });
      mesh.material = Array.isArray(original) ? clones : clones[0];
      return { mesh, original, clones };
    });

    return () => {
      for (const { mesh, original, clones } of restore) {
        mesh.material = original;
        clones.forEach((c) => c.dispose());
      }
    };
  }, [selectedKey, status, sceneKey, building, ifcUrl]);

  const hint = useMemo(
    () =>
      building || ifcUrl
        ? 'Drag to orbit · scroll to zoom · click any element'
        : 'Drag to orbit · click any part',
    [building, ifcUrl],
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-100/70 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">
            {stage
              ? `${stage}…`
              : gltfUrl
                ? `Loading model${progress > 0 ? ` ${progress}%` : ''}…`
                : 'Building model…'}
          </p>
          {ifcUrl && (
            <p className="max-w-xs text-center text-xs text-stone-600">
              Large IFC files take a few seconds to parse.
            </p>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-stone-100/90 p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-700" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-800">This model could not be loaded.</p>
          <p className="max-w-sm text-xs leading-relaxed text-stone-600">
            Check that it is a valid .glb file. Models loaded from a URL also need the host to allow
            cross-origin requests.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <p className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur">
          {hint}
        </p>
      )}
    </div>
  );
}
