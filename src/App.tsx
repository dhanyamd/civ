import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Leaf, Layers3, MousePointerClick, Palette, TriangleAlert } from 'lucide-react';
import { ModelLibrary, type CustomEntry } from '@/components/studio/ModelLibrary';
import { ModelViewer } from '@/components/studio/ModelViewer';
import { PartPanel } from '@/components/studio/PartPanel';
import { UploadedPartPanel } from '@/components/studio/UploadedPartPanel';
import { IfcPartPanel } from '@/components/studio/IfcPartPanel';
import { BuildingSummary } from '@/components/studio/BuildingSummary';
import { BUILDINGS, DEFAULT_BUILDING_ID } from '@/data/library';
import { DATA_VINTAGE } from '@/data/materials';
import { quantifyBuilding } from '@/lib/quantities';
import { fetchAiStatus } from '@/lib/insightClient';
import { fetchIfcCatalogue, type CatalogueEntry } from '@/lib/ifcCatalogue';
import { CURRENCIES, type CurrencyCode } from '@/lib/format';
import type { ViewMode } from '@/lib/sceneBuilder';
import type { BuildingModel, ViewerSelection } from '@/types/studio';
import type { LoadedIfc } from '@/lib/ifcLoader';

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export default function App() {
  const [buildingId, setBuildingId] = useState(DEFAULT_BUILDING_ID);
  const [custom, setCustom] = useState<CustomEntry | null>(null);
  const [showingCustom, setShowingCustom] = useState(false);
  const [selection, setSelection] = useState<ViewerSelection | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('materials');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [loadedIfc, setLoadedIfc] = useState<LoadedIfc | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [catalogueIndex, setCatalogueIndex] = useState(0);
  const objectUrlRef = useRef<string | null>(null);

  const building: BuildingModel =
    BUILDINGS.find((b) => b.id === buildingId) ?? BUILDINGS[0];

  const totals = useMemo(() => quantifyBuilding(building), [building]);

  useEffect(() => {
    void fetchAiStatus().then((s) => setAiReady(s.aiConfigured));
  }, []);

  // The IFC catalogue is listed live, so Generate steps through real models
  // rather than a fixed set baked into this file.
  useEffect(() => {
    const controller = new AbortController();
    fetchIfcCatalogue(controller.signal)
      .then(setCatalogue)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogueError(err instanceof Error ? err.message : 'Could not list the IFC models.');
      });
    return () => controller.abort();
  }, []);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const resetTo = useCallback((fn: () => void) => {
    fn();
    setSelection(null);
  }, []);

  const handleSelectBuilding = (b: BuildingModel) =>
    resetTo(() => {
      setBuildingId(b.id);
      setShowingCustom(false);
    });

  const handleUploadFile = (file: File) => {
    const name = file.name.toLowerCase();
    const isIfc = name.endsWith('.ifc');
    // .rvt is Autodesk's closed format — no open parser exists, so the file
    // cannot be read here at all. IFC is Revit's own open export and carries
    // the materials this app needs, so point there rather than just refusing.
    if (name.endsWith('.rvt')) {
      setUploadError(
        'Native Revit files can only be opened by Revit itself. In Revit: File → Export → IFC, then drop the .ifc here — the export keeps the material of every element, which is what this app reads.',
      );
      return;
    }
    if (!isIfc && !name.endsWith('.glb') && !name.endsWith('.gltf')) {
      setUploadError('Choose an .ifc file, or a single .glb. A .gltf with separate textures will not load on its own.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('That file is over 250 MB.');
      return;
    }
    setUploadError(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    resetTo(() => {
      setCustom({
        id: 'custom',
        name: file.name.replace(/\.(glb|gltf|ifc)$/i, ''),
        meta: `${(file.size / 1024 / 1024).toFixed(1)} MB · ${isIfc ? 'IFC, read in your browser' : 'read in your browser, not uploaded'}`,
        url,
        kind: isIfc ? 'ifc' : 'gltf',
      });
      setShowingCustom(true);
    });
  };

  const handleLoadUrl = (url: string, kind: 'gltf' | 'ifc') => {
    setUploadError(null);
    resetTo(() => {
      setCustom({
        id: 'custom',
        name: decodeURIComponent(url.split('/').pop() ?? '').replace(/\.(glb|gltf|ifc)$/i, '') || 'Remote model',
        meta: kind === 'ifc' ? 'IFC loaded from the web' : 'Loaded from a URL',
        url,
        kind,
      });
      setShowingCustom(true);
    });
  };

  /** Load the catalogue entry at the cursor, then advance it. */
  const handleGenerateNext = () => {
    if (!catalogue.length) return;
    const entry = catalogue[catalogueIndex % catalogue.length];
    setCatalogueIndex((i) => (i + 1) % catalogue.length);
    handleLoadUrl(entry.url, 'ifc');
  };



  const selectedElementQ =
    !showingCustom && selection?.kind === 'element'
      ? totals.elements.find((e) => e.element.id === selection.key)
      : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-stone-900">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-stone-200 bg-white px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Leaf className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <p className="text-sm font-semibold leading-tight">Material Studio</p>
            <p className="text-xs leading-tight text-stone-600">
              Sustainable material selection from a 3D model
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Colour the model by"
            className="flex rounded-lg bg-stone-100 p-0.5"
          >
            {(
              [
                { id: 'materials', label: 'Materials', Icon: Palette },
                { id: 'hotspots', label: 'Carbon', Icon: Layers3 },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={viewMode === id}
                onClick={() => setViewMode(id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  viewMode === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <select
            aria-label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs font-semibold text-stone-800 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          >
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>
                {c.symbol} {c.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {aiReady === false && (
        <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-5 py-2.5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-900">
            No <code className="font-mono">GROQ_API_KEY</code> on the server, so the written
            engineering review is unavailable. Every quantity, carbon figure and cost below is
            calculated locally and works regardless.
          </p>
        </div>
      )}

      {/* Height is set inline rather than as an arbitrary Tailwind calc() class,
          which is easy to get silently wrong. The viewer must not outgrow it. */}
      <main
        style={{ height: 'calc(100vh - 4rem)' }}
        className="grid min-h-0 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[292px_minmax(0,1fr)_396px] lg:gap-5 lg:p-5"
      >
        <aside className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <ModelLibrary
            buildings={BUILDINGS}
            custom={custom}
            activeId={showingCustom ? 'custom' : building.id}
            error={uploadError}
            onSelectBuilding={handleSelectBuilding}
            onSelectCustom={() => resetTo(() => setShowingCustom(true))}
            onUploadFile={handleUploadFile}
            onLoadUrl={handleLoadUrl}
            catalogue={catalogue}
            catalogueError={catalogueError}
            catalogueIndex={catalogueIndex}
            onGenerateNext={handleGenerateNext}
          />
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-b from-white via-stone-50 to-stone-200">
          <div className="relative flex-1">
            <ModelViewer
              building={showingCustom ? undefined : building}
              quantities={showingCustom ? undefined : totals.elements}
              gltfUrl={showingCustom && custom?.kind === 'gltf' ? custom.url : undefined}
              ifcUrl={showingCustom && custom?.kind === 'ifc' ? custom.url : undefined}
              onIfcLoaded={setLoadedIfc}
              viewMode={viewMode}
              selectedKey={selection?.key ?? null}
              onSelect={setSelection}
            />
            {viewMode === 'hotspots' && !showingCustom && (
              <div className="pointer-events-none absolute right-4 top-4 flex flex-col gap-1.5 rounded-xl bg-white/90 p-3 shadow-sm backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                  Carbon share
                </p>
                <div
                  className="h-1.5 w-28 rounded-full"
                  style={{ background: 'linear-gradient(to right, #d6d3d1, #f59e0b, #be123c)' }}
                  aria-hidden="true"
                />
                <div className="flex justify-between text-[11px] text-stone-600">
                  <span>low</span>
                  <span>high</span>
                </div>
              </div>
            )}
          </div>
          <p className="shrink-0 border-t border-stone-200/70 bg-white/60 px-4 py-2 text-[11px] leading-relaxed text-stone-500">
            {DATA_VINTAGE} Generic industry averages for early design comparison — replace with
            product EPDs on a real project. Costs are indicative rates, not a price.
          </p>
        </section>

        <aside className="flex flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {showingCustom && selection?.kind === 'ifc' ? (
            <IfcPartPanel
              key={selection.key}
              selection={selection}
              element={loadedIfc?.elements.get(Number(selection.key))}
              modelName={custom?.name ?? 'model'}
              currency={currency}
            />
          ) : showingCustom && selection?.kind === 'mesh' ? (
            <UploadedPartPanel selection={selection} modelName={custom?.name ?? 'model'} />
          ) : selectedElementQ ? (
            <PartPanel
              key={selectedElementQ.element.id}
              building={building}
              elementQ={selectedElementQ}
              buildingCarbonKg={totals.carbonKg}
              currency={currency}
            />
          ) : showingCustom ? (
            <Empty
              title="Click an element"
              body={
                custom?.kind === 'ifc'
                  ? `This IFC model names ${loadedIfc?.materialNames.length ?? 0} materials. Click a wall, slab or roof to see what it was specified with.`
                  : 'glTF models carry visual materials only, so the construction material is inferred from the part and material names in the file.'
              }
            />
          ) : (
            <Empty
              title="Click any element"
              body="See what it is made of, how much carbon and cost it carries, and which lower-impact materials could take its place."
            />
          )}

          {!showingCustom && (
            <BuildingSummary
              building={building}
              totals={totals}
              swaps={[]}
              currency={currency}
              selectedId={selection?.key ?? null}
              onSelectElement={(id) => {
                const q = totals.elements.find((e) => e.element.id === id);
                if (q) setSelection({ kind: 'element', key: id, label: q.element.name });
              }}
              onClearSwaps={() => undefined}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-stone-300 bg-white/50 p-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600">
        <MousePointerClick className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-stone-800">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-stone-600">{body}</p>
    </div>
  );
}
