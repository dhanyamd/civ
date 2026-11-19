import { useCallback } from 'react';
import { AlertTriangle, Check, Sparkles } from 'lucide-react';
import { InsightError, InsightLoading } from '@/components/studio/InsightState';
import { fetchSubstitutionReview, type InsightContext } from '@/lib/insightClient';
import { useInsight } from '@/hooks/useInsight';
import type { ReviewedOption } from '@/types/studio';

interface Props {
  /** the material being replaced, as named by the model or the IFC file */
  currentName: string;
  context: InsightContext;
}

/**
 * Alternatives are chosen by the model, not from a fixed list.
 *
 * That is a deliberate trade: the range is open — mycelium, LC3, hemp-lime,
 * anything that fits the element — but the percentages are the model's own
 * estimates rather than figures traced to an EPD, so they are labelled as
 * estimates and will shift a little between runs.
 */
export function MaterialOptimise({ currentName, context }: Props) {
  const key = `review:${context.material}:${context.elementName}`;
  const fetcher = useCallback(
    (signal: AbortSignal) => fetchSubstitutionReview(context, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const { state, retry } = useInsight(key, fetcher);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-stone-700">
        Lower-impact materials that could replace{' '}
        <span className="font-bold text-stone-900">{currentName.toLowerCase()}</span> in this
        element.
      </p>

      {state.status === 'loading' && (
        <InsightLoading message="Finding greener options for this element…" />
      )}
      {state.status === 'error' && <InsightError message={state.message} onRetry={retry} />}

      {state.status === 'ready' && (
        <>
          <div className="flex flex-col gap-4">
            {state.data.options.map((option) => (
              <Alternative key={option.id} option={option} />
            ))}
            {state.data.options.length === 0 && (
              <p className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
                No workable alternative was suggested for this element.
              </p>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-stone-500">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              Percentages are the model&rsquo;s estimates based on published LCA data, not figures
              measured from a specific product. Use them to rank options, then confirm with a real
              EPD before specifying.
            </span>
          </p>
        </>
      )}
    </div>
  );
}

function Alternative({ option }: { option: ReviewedOption }) {
  const carbon = option.carbonDeltaPct;
  const cost = option.costDeltaPct;

  return (
    <article className="flex animate-fade-up flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold leading-tight text-stone-900">{option.name}</h3>
        {carbon != null && (
          <span
            className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold ${
              carbon < 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
            }`}
          >
            {carbon > 0 ? '+' : ''}
            {carbon}%
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Figure label="Embodied carbon" pct={carbon} goodWhenLower />
        <Figure label="Cost" pct={cost} goodWhenLower />
      </div>

      {option.description && (
        <p className="text-[15px] leading-relaxed text-stone-800">{option.description}</p>
      )}

      {option.advantages.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-base font-bold text-stone-900">Advantages</h4>
          <ul className="flex flex-col gap-2">
            {option.advantages.map((a) => (
              <li key={a} className="flex gap-2.5 text-[15px] leading-relaxed text-stone-800">
                <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {option.caution && (
        <p className="flex gap-2.5 rounded-xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>{option.caution}</span>
        </p>
      )}
    </article>
  );
}

function Figure({
  label,
  pct,
  goodWhenLower,
}: {
  label: string;
  pct: number | null;
  goodWhenLower: boolean;
}) {
  const good = pct != null && (goodWhenLower ? pct < 0 : pct > 0);
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-stone-200 p-3">
      <span className="text-xs font-bold uppercase tracking-wider text-stone-600">{label}</span>
      {pct == null ? (
        <span className="font-mono text-lg font-bold leading-none text-stone-500">—</span>
      ) : (
        <>
          <span
            className={`font-mono text-lg font-bold leading-none ${
              good ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            {pct > 0 ? '+' : ''}
            {pct}%
          </span>
          <span className="text-xs font-semibold text-stone-600">
            {pct === 0 ? 'about the same' : pct < 0 ? 'lower' : 'higher'}
          </span>
        </>
      )}
    </div>
  );
}
