import { useEffect, useState } from 'react';
import { Layers, Ruler, Wind } from 'lucide-react';
import { MaterialDetails } from '@/components/studio/MaterialDetails';
import { MaterialOptimise } from '@/components/studio/MaterialOptimise';
import { carbon, mass, money, share, volume, type CurrencyCode } from '@/lib/format';
import { ROLE_LABEL, type BuildingModel, type ElementQuantity } from '@/types/studio';
import type { InsightContext } from '@/lib/insightClient';

type Tab = 'details' | 'optimise';

interface Props {
  building: BuildingModel;
  elementQ: ElementQuantity;
  buildingCarbonKg: number;
  currency: CurrencyCode;
}

export function PartPanel({
  building,
  elementQ,
  buildingCarbonKg,
  currency,
}: Props) {
  const element = elementQ.element;
  const [tab, setTab] = useState<Tab>('details');
  // Panels are mounted on first visit and then kept mounted, so flipping tabs
  // never re-runs a model call or loses scroll position. Optimise is not
  // mounted up front because that would fire a second call for every click.
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['details']));
  const [materialId, setMaterialId] = useState(elementQ.materials[0]?.material.id ?? '');

  // Reset to the dominant material whenever a different element is picked.
  useEffect(() => {
    setMaterialId(elementQ.materials[0]?.material.id ?? '');
    setTab('details');
    setVisited(new Set<Tab>(['details']));
  }, [element.id, elementQ.materials]);

  const current = elementQ.materials.find((m) => m.material.id === materialId) ?? elementQ.materials[0];
  if (!current) {
    return (
      <Shell element={element} elementQ={elementQ} currency={currency}>
        <p className="text-sm text-stone-700">This element has no material breakdown.</p>
      </Shell>
    );
  }

  const context: InsightContext = {
    material: current.material.name,
    role: ROLE_LABEL[element.role],
    elementName: element.name,
    quantities: {
      volumeM3: current.volumeM3,
      massKg: current.massKg,
      count: elementQ.count,
    },
    span: element.span,
    exposure: element.exposure,
    building: building.aiContext,
  };

  return (
    <Shell element={element} elementQ={elementQ} currency={currency}>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600">
          <Layers className="h-3 w-3" aria-hidden="true" />
          Materials in this element
        </p>
        <div className="flex flex-wrap gap-1.5">
          {elementQ.materials.map((m) => {
            const active = m.material.id === current.material.id;
            return (
              <button
                key={m.material.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMaterialId(m.material.id)}
                title={m.material.name}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  active
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-stone-300"
                  style={{ backgroundColor: m.material.colour }}
                  aria-hidden="true"
                />
                {m.material.short}
              </button>
            );
          })}
        </div>
        {current.material.id && (
          <p className="text-xs text-stone-500">
            {element.composition.find((c) => c.materialId === current.material.id)?.layer ??
              'Material layer'}
          </p>
        )}
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
        {(
          [
            { id: 'details', label: 'Details' },
            { id: 'optimise', label: 'Optimise' },
          ] as const
        ).map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.id);
                setVisited((seen) => (seen.has(t.id) ? seen : new Set(seen).add(t.id)));
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div key={current.material.id}>
        <div hidden={tab !== 'details'}>
          <MaterialDetails
            quantity={current}
            context={context}
            carbonShareOfBuilding={buildingCarbonKg > 0 ? current.carbonKg / buildingCarbonKg : 0}
            currency={currency}
          />
        </div>
        {visited.has('optimise') && (
          <div hidden={tab !== 'optimise'}>
            <MaterialOptimise currentName={current.material.short} context={context} />
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({
  element,
  elementQ,
  currency,
  children,
}: {
  element: ElementQuantity['element'];
  elementQ: ElementQuantity;
  currency: CurrencyCode;
  children: React.ReactNode;
}) {
  const hotspot = elementQ.carbonShare >= 0.08;
  return (
    <div className="flex animate-fade-up flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-stone-700">
            {ROLE_LABEL[element.role]}
          </span>
          {elementQ.count > 1 && (
            <span className="text-xs text-stone-500">{elementQ.count} instances</span>
          )}
          {hotspot && (
            <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-900">
              Carbon hotspot
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-snug text-stone-900">{element.name}</h2>

        <dl className="flex flex-col gap-1.5">
          {element.span && (
            <Meta icon={<Ruler className="h-3 w-3" aria-hidden="true" />}>{element.span}</Meta>
          )}
          {element.exposure && (
            <Meta icon={<Wind className="h-3 w-3" aria-hidden="true" />}>{element.exposure}</Meta>
          )}
        </dl>

        {/* Embodied carbon is the headline this whole tool exists to surface,
            so it gets the hero slot and everything else reads as supporting. */}
        <div
          className={`mt-1 flex flex-col gap-1 rounded-xl border p-4 ${
            hotspot ? 'border-rose-300 bg-rose-50' : 'border-emerald-200 bg-emerald-50/70'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Embodied carbon
          </span>
          <span
            className={`font-mono text-3xl font-bold leading-none tracking-tight ${
              hotspot ? 'text-rose-900' : 'text-emerald-900'
            }`}
          >
            {carbon(elementQ.carbonKg)}
          </span>
          <span className="text-xs font-semibold text-stone-700">
            {share(elementQ.carbonShare)} of this building's total
          </span>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/80">
            <div
              className={`h-full rounded-full ${hotspot ? 'bg-rose-600' : 'bg-emerald-600'}`}
              style={{ width: `${Math.min(100, elementQ.carbonShare * 100 * 3)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-y-3">
          <Mini label="Volume" value={volume(elementQ.netVolumeM3)} />
          <Mini label="Mass" value={mass(elementQ.massKg)} />
          <Mini label="Cost" value={money(elementQ.costUsd, currency)} />
        </div>

        {element.note && (
          <p className="rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
            {element.note}
          </p>
        )}
      </header>

      {children}
    </div>
  );
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed text-stone-600">
      <span className="mt-0.5 shrink-0 text-stone-500">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-stone-600">{label}</span>
      <span className="font-mono text-xs font-semibold text-stone-900">{value}</span>
    </div>
  );
}
