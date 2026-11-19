import { useCallback } from 'react';
import { AlertTriangle, BadgeCheck, ExternalLink } from 'lucide-react';
import { InsightError, InsightLoading } from '@/components/studio/InsightState';
import { fetchMaterialProfile, type InsightContext } from '@/lib/insightClient';
import { useInsight } from '@/hooks/useInsight';
import { carbon, mass, money, share, volume, type CurrencyCode } from '@/lib/format';
import type { MaterialQuantity } from '@/types/studio';

interface Props {
  quantity: MaterialQuantity;
  context: InsightContext;
  carbonShareOfBuilding: number;
  currency: CurrencyCode;
}

export function MaterialDetails({ quantity, context, carbonShareOfBuilding, currency }: Props) {
  const spec = quantity.material;
  const key = `profile:${spec.id}:${context.elementName}`;
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchMaterialProfile(context, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const { state, retry } = useInsight(key, fetcher);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold leading-tight text-stone-900">{spec.name}</h3>
        <p className="text-sm font-semibold text-stone-600">
          {volume(quantity.volumeM3)} · {mass(quantity.massKg)} in this element
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Embodied carbon"
          value={carbon(quantity.carbonKg)}
          // IFC elements have no whole-building total to divide by, so the
          // share line is simply omitted rather than shown as a bogus 0%.
          sub={carbonShareOfBuilding > 0 ? `${share(carbonShareOfBuilding)} of the building` : 'cradle to gate, A1–A3'}
          tone="carbon"
        />
        <Metric label="Cost" value={money(quantity.costUsd, currency)} sub="supply and fix" />
      </div>

      {/* Every step of the arithmetic, plus where the one external number came
          from, so there is nothing here to take on trust. */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
            How that carbon figure is reached
          </h4>
          {spec.dataQuality === 'epd' ? (
            <span className="flex shrink-0 items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              Verified EPD
            </span>
          ) : (
            <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Estimate
            </span>
          )}
        </div>

        <p className="font-mono text-xs leading-relaxed text-stone-800">
          {volume(quantity.volumeM3)} × {spec.densityKgM3} kg/m³ = {mass(quantity.massKg)}
          <br />
          {mass(quantity.massKg)} × {spec.carbonPerKg.toFixed(4)} kgCO₂e/kg ={' '}
          <span className="font-bold">{carbon(quantity.carbonKg)}</span>
        </p>

        {spec.epd ? (
          <div className="flex flex-col gap-1.5 border-t border-stone-200 pt-2.5">
            <p className="text-xs leading-relaxed text-stone-700">
              Volume is measured from the model. The {spec.carbonPerKg.toFixed(4)} kgCO₂e/kg factor
              is {spec.epd.basis}, modules A1–A3, taken from a published Environmental Product
              Declaration:
            </p>
            <p className="text-xs font-semibold leading-snug text-stone-900">{spec.epd.epdName}</p>
            <p className="font-mono text-[11px] leading-relaxed text-stone-600">
              {spec.epd.gwpFossilA1A3} kgCO₂e per {spec.epd.declaredAmount}{' '}
              {spec.epd.declaredUnit} ({spec.epd.declaredMassKg} kg)
              {spec.epd.refYear ? ` · ${spec.epd.refYear}` : ''}
              {spec.epd.compliance.length ? ` · ${spec.epd.compliance[0]}` : ''}
            </p>
            <a
              href={spec.epd.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 text-xs font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
            >
              Open the EPD in Ökobaudat
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        ) : (
          <div className="flex gap-2 border-t border-stone-200 pt-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-stone-700">
              No EPD matched this material in Ökobaudat, so the factor is an industry average rather
              than a measured, verified figure. Treat it as indicative and replace it with a product
              EPD before relying on it.
            </p>
          </div>
        )}
      </div>

      {state.status === 'loading' && <InsightLoading message="Writing the description…" />}
      {state.status === 'error' && <InsightError message={state.message} onRetry={retry} />}
      {state.status === 'ready' && (
        <div className="flex animate-fade-up flex-col gap-6">
          <p className="text-[15px] leading-relaxed text-stone-800">{state.data.description}</p>

          {state.data.disadvantages.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h4 className="text-base font-bold text-stone-900">Disadvantages</h4>
              <ul className="flex flex-col gap-2.5">
                {state.data.disadvantages.map((d) => (
                  <li key={d} className="flex gap-2.5 text-[15px] leading-relaxed text-stone-800">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'carbon';
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border p-3.5 ${
        tone === 'carbon' ? 'border-stone-300 bg-stone-50' : 'border-stone-200 bg-white'
      }`}
    >
      <span className="text-xs font-bold uppercase tracking-wider text-stone-600">{label}</span>
      <span className="font-mono text-xl font-bold leading-none text-stone-900">{value}</span>
      <span className="text-xs font-semibold text-stone-600">{sub}</span>
    </div>
  );
}
