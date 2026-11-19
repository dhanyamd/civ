import { useRef, useState } from 'react';
import { Building2, FileCode2, Link2, Shuffle, Upload } from 'lucide-react';
import { SAMPLE_GLTF_URLS, SAMPLE_IFC_MODELS } from '@/data/library';
import type { CatalogueEntry } from '@/lib/ifcCatalogue';
import type { BuildingModel } from '@/types/studio';

export interface CustomEntry {
  id: string;
  name: string;
  meta: string;
  url: string;
  /** IFC carries real material data; glTF does not */
  kind: 'gltf' | 'ifc';
}

interface Props {
  buildings: BuildingModel[];
  custom: CustomEntry | null;
  activeId: string;
  error: string | null;
  onSelectBuilding: (b: BuildingModel) => void;
  onSelectCustom: () => void;
  onUploadFile: (file: File) => void;
  onLoadUrl: (url: string, kind: 'gltf' | 'ifc') => void;
  catalogue: CatalogueEntry[];
  catalogueError: string | null;
  catalogueIndex: number;
  onGenerateNext: () => void;
}

export function ModelLibrary({
  buildings,
  custom,
  activeId,
  error,
  onSelectBuilding,
  onSelectCustom,
  onUploadFile,
  onLoadUrl,
  catalogue,
  catalogueError,
  catalogueIndex,
  onGenerateNext,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Scheduled buildings
          </h2>
          <span className="text-xs text-stone-500">{buildings.length}</span>
        </div>

        <div className="flex flex-col gap-2">
          {buildings.map((b) => {
            const active = b.id === activeId;
            return (
              <button
                key={b.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectBuilding(b)}
                className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  active
                    ? 'border-emerald-700 bg-white shadow-sm ring-1 ring-emerald-700'
                    : 'border-stone-200 bg-white/50 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200'
                  }`}
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold leading-snug text-stone-900">{b.name}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    {b.typology}
                  </span>
                  <span className="text-xs leading-relaxed text-stone-600">{b.description}</span>
                  <span className="text-xs text-stone-500">
                    {b.elements.length} elements · {b.grossFloorAreaM2.toLocaleString('en-GB')} m² GFA
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Real IFC buildings
          </h2>
          <span className="text-xs text-stone-500">
            {catalogue.length ? `${catalogueIndex + 1} / ${catalogue.length}` : SAMPLE_IFC_MODELS.length}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-stone-600">
          Actual BIM models carrying the materials their engineers specified. Loaded from the web.
        </p>

        <button
          type="button"
          onClick={onGenerateNext}
          disabled={!catalogue.length}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          <Shuffle className="h-4 w-4" aria-hidden="true" />
          {catalogue.length ? 'Generate next building' : 'Loading catalogue…'}
        </button>

        {catalogue.length > 0 && (
          <p className="text-xs leading-relaxed text-stone-600">
            Next up:{' '}
            <span className="font-semibold text-stone-800">{catalogue[catalogueIndex]?.name}</span>{' '}
            <span className="text-stone-500">({catalogue[catalogueIndex]?.sizeLabel})</span>
          </p>
        )}
        {catalogueError && <p className="text-xs text-amber-800">{catalogueError}</p>}
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Or pick a known-good one
        </p>
        <div className="flex flex-col gap-2">
          {SAMPLE_IFC_MODELS.map((m) => {
            const on = activeId === 'custom' && custom?.url === m.url;
            return (
              <button
                key={m.url}
                type="button"
                aria-pressed={on}
                onClick={() => onLoadUrl(m.url, 'ifc')}
                className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  on
                    ? 'border-emerald-700 bg-white shadow-sm ring-1 ring-emerald-700'
                    : 'border-stone-200 bg-white/50 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    on ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100'
                  }`}
                >
                  <FileCode2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-bold leading-snug text-stone-900">{m.label}</span>
                  <span className="text-xs text-stone-500">{m.note}</span>
                  <span className="text-xs leading-relaxed text-stone-700">{m.materials}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Your own model
        </h2>

        {custom && (
          <button
            type="button"
            aria-pressed={custom.id === activeId}
            onClick={onSelectCustom}
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
              custom.id === activeId
                ? 'border-emerald-700 bg-white shadow-sm ring-1 ring-emerald-700'
                : 'border-stone-200 bg-white/50 hover:border-stone-300 hover:bg-white'
            }`}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <Upload className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-stone-900">{custom.name}</span>
              <span className="text-xs text-stone-500">{custom.meta}</span>
            </span>
          </button>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onUploadFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
            dragging ? 'border-emerald-700 bg-emerald-50' : 'border-stone-300 bg-white/40 hover:border-stone-400'
          }`}
        >
          <Upload className="h-5 w-5 text-stone-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-800">Drop an .ifc or .glb model</p>
          <p className="text-xs text-stone-600">or click to choose a file · from Revit, export as IFC</p>
          {/*
            .rvt is listed so the picker offers it and the handler can explain the
            IFC export, rather than the file being invisible to the user.
          */}
          <input
            ref={inputRef}
            type="file"
            accept=".glb,.gltf,.ifc,.rvt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadFile(file);
              e.target.value = '';
            }}
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = url.trim();
            if (value) onLoadUrl(value, /\.ifc$/i.test(value) ? 'ifc' : 'gltf');
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="model-url" className="text-xs text-stone-600">
            …or load one from a URL
          </label>
          <div className="flex gap-2">
            <input
              id="model-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/model.glb"
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-800 placeholder:text-stone-500 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              Load
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {SAMPLE_GLTF_URLS.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => {
                  setUrl(s.url);
                  onLoadUrl(s.url, 'gltf');
                }}
                title={s.note}
                className="w-fit text-left text-xs text-emerald-800 underline decoration-emerald-300 underline-offset-2 transition-colors hover:text-emerald-900"
              >
                Try: {s.label}
              </button>
            ))}
          </div>
        </form>

        {error && <p className="text-xs leading-relaxed text-rose-700">{error}</p>}

        <p className="rounded-lg bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">
          glTF and GLB are rendering formats: they carry the materials needed to draw a surface, not
          engineering material data. Uploaded models are inspected for their visual materials and the
          construction material is inferred. For real quantities you need IFC or a BIM export.
        </p>
      </section>
    </div>
  );
}
