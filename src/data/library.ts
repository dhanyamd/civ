import { CLINIC } from './buildings/clinic';
import { TOWER } from './buildings/tower';
import { WAREHOUSE } from './buildings/warehouse';
import type { BuildingModel } from '@/types/studio';

/**
 * The demo library: fully scheduled parametric buildings where every element
 * carries a real material breakdown, so clicking anything gives a genuine
 * quantity and a genuine carbon figure.
 *
 * Downloaded and uploaded glTF files are handled separately — see
 * `components/studio/ModelLibrary.tsx`. They are rendering files, not BIM
 * files, so they carry visual materials only and the app says so rather than
 * pretending otherwise.
 */
export const BUILDINGS: BuildingModel[] = [CLINIC, TOWER, WAREHOUSE];

export const DEFAULT_BUILDING_ID = CLINIC.id;

/**
 * Public glTF files that can be pulled in at runtime over CORS. Offered as
 * presets for the URL box rather than bundled into the repo, so no third-party
 * licence terms ride along with this project.
 */
/**
 * Real IFC building models, pulled in at runtime over CORS.
 *
 * These are the point of IFC support: unlike glTF, each one carries the
 * material every element was actually specified with — "Masonry - Brick",
 * "Metal - Steel - 345 MPa", "Roofing - EPDM Membrane" — authored by whoever
 * modelled the building, not invented here.
 */
export const SAMPLE_IFC_MODELS: {
  label: string;
  url: string;
  note: string;
  materials: string;
}[] = [
  {
    label: 'Duplex apartment',
    url: 'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/duplex.ifc',
    note: '3 MB · the richest material set of the three',
    materials:
      'Cast in-situ concrete, brick, concrete block, grout, steel 345 MPa, rigid and semi-rigid insulation, EPDM, plasterboard, ceramic tile, lumber, plywood',
  },
  {
    label: 'Office building',
    url: 'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/Office_A_20110811.ifc',
    note: '4 MB · office, mostly envelope and fit-out',
    materials: 'Brick, insulated panel, metal stud, plasterboard, Type-X plasterboard, plywood',
  },
  {
    label: 'Dental clinic',
    url: 'https://raw.githubusercontent.com/ThatOpen/engine_web-ifc/main/tests/ifcfiles/public/dental_clinic.ifc',
    note: '13 MB · slower to parse, worth the wait',
    materials: 'Glass, aluminium, insulated panel, metal stud, plasterboard, plywood',
  },
];

export const SAMPLE_GLTF_URLS: { label: string; url: string; note: string }[] = [
  {
    label: 'Khronos — Virtual City',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/VirtualCity/glTF-Binary/VirtualCity.glb',
    note: '3 MB, 135 meshes. Licensed for glTF testing only — fine to view, not to redistribute.',
  },
  {
    label: 'three.js — Littlest Tokyo',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LittlestTokyo.glb',
    note: '4 MB, 71 meshes. CC-BY, by Glen Fox.',
  },
];
