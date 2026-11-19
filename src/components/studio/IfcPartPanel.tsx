import { useEffect, useMemo, useState } from 'react';
import { FileCode2, HelpCircle } from 'lucide-react';
import { MaterialDetails } from '@/components/studio/MaterialDetails';
import { MaterialOptimise } from '@/components/studio/MaterialOptimise';
import { matchIfcMaterial, roleFromIfcType } from '@/lib/ifcMaterialMap';
import { volume } from '@/lib/format';
import type { CurrencyCode } from '@/lib/format';
import { ROLE_LABEL, type MaterialQuantity, type ViewerSelection } from '@/types/studio';
import type { IfcElement } from '@/lib/ifcLoader';
import type { InsightContext } from '@/lib/insightClient';

type Tab = 'details' | 'optimise';

interface Props {
  selection: ViewerSelection;
  element: IfcElement | undefined;
  modelName: string;
  currency: CurrencyCode;
}

/**
 * Panel for an element of a real IFC building model.
 *
 * Unlike glTF, the material here is not inferred — it is the string the
 * engineer wrote into the file. The panel shows that raw string next to the
 * dataset entry it matched, so the mapping is auditable rather than magic.
 */
export function IfcPartPanel({ selection, element, modelName, currency }: Props) {
  const [tab, setTab] = useState<Tab>('details');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['details']));
  const [chosen, setChosen] = useState(0);

  useEffect(() => {
    setChosen(0);
    setTab('details');
    setVisited(new Set<Tab>(['details']));
  }, [selection.key]);

  const matches = useMemo(
    () => (element?.materials ?? []).map((name) => matchIfcMaterial(name)),
    [element],
  );

  const role = roleFromIfcType(element?.ifcType ?? '');
  const vol = selection.meshVolumeM3;
  const usable = matches.filter((m) => m.spec);
  const current = usable[Math.min(chosen, Math.max(0, usable.length - 1))];

  // Quantity straight off the file's own geometry, not a modelled assumption.
  const quantity: MaterialQuantity | null = useMemo(() => {
    if (!current?.spec || !vol) return null;
    const spec = current.spec;
    const massKg = vol * spec.densityKgM3;
    return {
      material: spec,
      volumeM3: vol,
      massKg,
      carbonKg: massKg * spec.carbonPerKg,
      biogenicKg: massKg * (spec.biogenicPerKg ?? 0),
      costUsd: massKg * spec.costPerKgUsd,
    };
  }, [current, vol]);


  const context: InsightContext | null = quantity
    ? {
        material: `${quantity.material.name} (named "${current?.ifcName}" in the IFC file)`,
        role: ROLE_LABEL[role],
        elementName: element?.name ?? selection.label,
        quantities: { volumeM3: quantity.volumeM3, massKg: quantity.massKg },
        building: `An element of a real IFC building model, "${modelName}". IFC entity type ${element?.ifcType || 'unknown'}. The material was specified by whoever authored the model as "${current?.ifcName}".`,
      }
    : null;

  return (
    <div className="flex animate-fade-up flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            <FileCode2 className="h-3 w-3" aria-hidden="true" />
            Real IFC model
          </span>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-stone-700">
            {ROLE_LABEL[role]}
          </span>
        </div>
        <h2 className="text-lg font-bold leading-snug text-stone-900">
          {element?.name ?? selection.label}
        </h2>
        {element?.ifcType && (
          <p className="font-mono text-xs text-stone-600">{element.ifcType}</p>
        )}
      </header>

      {/* The file's own words, before anything is done with them. */}
      <section className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
          Materials written in the file
        </h3>
        {matches.length === 0 ? (
          <p className="text-sm text-stone-700">
            This element has no material association in the IFC file.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matches.map((m, i) => {
              const selectable = Boolean(m.spec);
              const isCurrent = selectable && usable.indexOf(m) === Math.min(chosen, usable.length - 1);
              return (
                <li key={`${m.ifcName}-${i}`}>
                  <button
                    type="button"
                    disabled={!selectable}
                    onClick={() => setChosen(usable.indexOf(m))}
                    className={`flex w-full flex-col gap-0.5 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-default ${
                      isCurrent
                        ? 'border-emerald-700 bg-white ring-1 ring-emerald-700'
                        : selectable
                          ? 'border-stone-200 bg-white hover:border-stone-300'
                          : 'border-dashed border-stone-300 bg-transparent'
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-stone-900">{m.ifcName}</span>
                    {m.spec ? (
                      <span className="text-xs font-semibold text-emerald-800">
                        → {m.spec.name} · {m.spec.carbonPerKg.toFixed(3)} kgCO₂e/kg
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-stone-600">
                        <HelpCircle className="h-3 w-3" aria-hidden="true" />
                        {m.reason}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {vol != null && (
          <p className="text-xs font-semibold text-stone-600">
            Geometry volume from the file: {volume(vol)}
          </p>
        )}
      </section>

      {!quantity || !context ? (
        <p className="rounded-xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
          {matches.length === 0
            ? 'Without a material association there is nothing to assess. Try another element — walls, slabs and roofs usually carry one.'
            : usable.length === 0
              ? 'None of this element’s materials matched the carbon dataset yet.'
              : 'This element’s geometry is not closed, so no reliable volume could be measured from it.'}
        </p>
      ) : (
        <>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
            {(
              [
                { id: 'details', label: 'Details' },
                { id: 'optimise', label: 'Optimise' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                onClick={() => {
                  setTab(t.id);
                  setVisited((seen) => (seen.has(t.id) ? seen : new Set(seen).add(t.id)));
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  t.id === tab ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div key={current?.ifcName}>
            <div hidden={tab !== 'details'}>
              <MaterialDetails
                quantity={quantity}
                context={context}
                carbonShareOfBuilding={0}
                currency={currency}
              />
            </div>
            {visited.has('optimise') && (
              <div hidden={tab !== 'optimise'}>
                <MaterialOptimise
                  currentName={current?.spec?.short ?? current?.ifcName ?? 'this material'}
                  context={context}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
