import { ChevronRight, TrendingDown } from 'lucide-react';
import { hotspotColour } from '@/lib/sceneBuilder';
import { carbon, carbonDelta, money, moneyDelta, share, type CurrencyCode } from '@/lib/format';
import type { AcceptedSwap, BuildingModel, BuildingTotals } from '@/types/studio';

interface Props {
  building: BuildingModel;
  totals: BuildingTotals;
  swaps: AcceptedSwap[];
  currency: CurrencyCode;
  selectedId: string | null;
  onSelectElement: (elementId: string) => void;
  onClearSwaps: () => void;
}

export function BuildingSummary({
  building,
  totals,
  swaps,
  currency,
  selectedId,
  onSelectElement,
  onClearSwaps,
}: Props) {
  const swapCarbon = swaps.reduce((a, s) => a + s.carbonDeltaKg, 0);
  const swapCost = swaps.reduce((a, s) => a + s.costDeltaUsd, 0);
  const improved = totals.carbonKg + swapCarbon;
  const pct = totals.carbonKg > 0 ? (-swapCarbon / totals.carbonKg) * 100 : 0;

  const top = totals.elements.slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Whole building, as designed
          </h2>
          <p className="text-xs text-stone-500">
            {building.storeys} storey{building.storeys > 1 ? 's' : ''} ·{' '}
            {building.grossFloorAreaM2.toLocaleString('en-GB')} m² GFA · {building.elements.length}{' '}
            elements
          </p>
        </div>

        {/* Total embodied carbon is the number the whole assessment turns on. */}
        <div className="flex items-end justify-between gap-3 rounded-xl border border-stone-300 bg-stone-50 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Embodied carbon
            </span>
            <span className="font-mono text-3xl font-bold leading-none tracking-tight text-stone-900">
              {carbon(totals.carbonKg)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="font-mono text-lg font-bold leading-none text-stone-900">
              {Math.round(totals.carbonPerM2)}
            </span>
            <span className="text-xs font-semibold text-stone-700">kgCO₂e/m² GFA</span>
            <span className="max-w-[9rem] text-[11px] font-semibold leading-snug text-stone-600">
              {benchmark(totals.carbonPerM2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Big label="Material cost" value={money(totals.costUsd, currency)} />
          <Big label="Material mass" value={`${Math.round(totals.massKg / 1000).toLocaleString('en-GB')} t`} />
        </div>

        {totals.biogenicKg < -1 && (
          <p className="text-xs leading-relaxed text-emerald-800">
            Plus {carbon(Math.abs(totals.biogenicKg))} of biogenic carbon stored in bio-based
            materials, reported separately because it returns to atmosphere if those products are
            burnt or landfilled.
          </p>
        )}
      </section>

      {swaps.length > 0 && (
        <section className="flex animate-fade-up flex-col gap-3 rounded-2xl border border-emerald-700 bg-emerald-50/60 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-900">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              With {swaps.length} substitution{swaps.length > 1 ? 's' : ''}
            </h2>
            <button
              type="button"
              onClick={onClearSwaps}
              className="text-xs font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Big label="Revised carbon" value={carbon(improved)} tone="emerald" />
            <Big
              label="Change"
              value={`${carbonDelta(swapCarbon)}`}
              sub={`${pct >= 0 ? '−' : '+'}${Math.abs(pct).toFixed(1)}% of the baseline`}
              tone="emerald"
            />
            <Big label="Revised per m²" value={`${Math.round(improved / building.grossFloorAreaM2)} kg/m²`} tone="emerald" />
            <Big label="Cost change" value={moneyDelta(swapCost, currency)} tone="emerald" />
          </div>

          <ul className="flex flex-col divide-y divide-emerald-200/70">
            {swaps.map((s) => (
              <li key={`${s.elementId}:${s.fromMaterialId}`} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                <span className="text-xs font-semibold text-emerald-950">{s.elementName}</span>
                <span className="font-mono text-[11px] text-emerald-800">
                  {carbonDelta(s.carbonDeltaKg)} · {moneyDelta(s.costDeltaUsd, currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Where the carbon is
        </h2>
        <p className="text-xs leading-relaxed text-stone-600">
          Ranked by embodied carbon. The top few elements almost always hold most of the total —
          start there, not with the finishes.
        </p>

        <ul className="flex flex-col gap-1">
          {top.map((e) => {
            const active = e.element.id === selectedId;
            const width = totals.elements[0].carbonKg > 0 ? (e.carbonKg / totals.elements[0].carbonKg) * 100 : 0;
            return (
              <li key={e.element.id}>
                <button
                  type="button"
                  onClick={() => onSelectElement(e.element.id)}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                    active ? 'bg-stone-100' : 'hover:bg-stone-50'
                  }`}
                >
                  <span
                    className="h-7 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `#${hotspotColour(e.carbonShare).getHexString()}` }}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-stone-800">
                        {e.element.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-stone-600">
                        {share(e.carbonShare)}
                      </span>
                    </span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-stone-100">
                      <span
                        className="block h-full rounded-full bg-stone-400 transition-all group-hover:bg-stone-500"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                  </span>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-stone-600"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Rough context for a kgCO2e/m² figure, using widely cited design targets. */
function benchmark(perM2: number): string {
  if (perM2 < 350) return 'within typical new-build targets';
  if (perM2 < 600) return 'typical for conventional construction';
  if (perM2 < 900) return 'above typical — worth interrogating';
  return 'very high for its floor area';
}

function Big({
  label,
  value,
  sub,
  tone = 'stone',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'stone' | 'emerald';
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-xl border p-3 ${
        tone === 'emerald' ? 'border-emerald-200 bg-white/70' : 'border-stone-200 bg-stone-50/60'
      }`}
    >
      <span className="text-[11px] text-stone-600">{label}</span>
      <span className="font-mono text-sm font-semibold text-stone-900">{value}</span>
      {sub && <span className="text-[11px] leading-snug text-stone-600">{sub}</span>}
    </div>
  );
}
