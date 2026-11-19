import { useCallback, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { AiLabel, InsightError, InsightLoading } from '@/components/studio/InsightState';
import { fetchMaterialProfile } from '@/lib/insightClient';
import { useInsight } from '@/hooks/useInsight';
import { cleanVisualName, volume } from '@/lib/format';
import { ROLE_LABEL, type ElementRole, type ViewerSelection } from '@/types/studio';

const ROLES = Object.keys(ROLE_LABEL) as ElementRole[];

interface Props {
  selection: ViewerSelection;
  modelName: string;
}

/**
 * Panel for a part of an uploaded or downloaded glTF file.
 *
 * These files carry rendering materials, not engineering ones, so there is no
 * schedule to read a quantity from. Rather than invent one, the panel asks what
 * the part actually is and then reasons from the visual material name — and it
 * says plainly that the numbers a scheduled building gives are not available.
 */
export function UploadedPartPanel({ selection, modelName }: Props) {
  const [role, setRole] = useState<ElementRole>('misc');
  const visual = selection.visualMaterials ?? [];
  const materialNames = visual.map((v) => cleanVisualName(v.name)).join(', ') || 'unnamed material';

  const key = `gltf:${selection.key}:${role}`;
  const context = useMemo(
    () => ({
      material: materialNames,
      role: ROLE_LABEL[role],
      elementName: selection.label,
      quantities: selection.meshVolumeM3 ? { volumeM3: selection.meshVolumeM3 } : undefined,
      building: `An uploaded glTF model named "${modelName}". This is a rendering file, so the only material information available is the visual material name read off the file: "${materialNames}". Infer the most likely real construction material from that name, the part name and the stated structural role, and say clearly in the summary what you inferred and how confident that inference is.`,
    }),
    [materialNames, role, selection.label, selection.meshVolumeM3, modelName],
  );

  const fetcher = useCallback(
    (signal: AbortSignal) => fetchMaterialProfile(context, signal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  const { state, retry } = useInsight(key, fetcher);

  return (
    <div className="flex animate-fade-up flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-900">
          Uploaded model
        </span>
        <h2 className="text-lg font-semibold leading-snug text-stone-900">{selection.label}</h2>
      </header>

      <div className="flex items-start gap-2 rounded-xl bg-stone-50 p-3.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-stone-700">
          glTF stores how a surface should look, not what it is built from, so there is no quantity
          or carbon figure to calculate here. Pick the structural role and the construction material
          is inferred from the visual material name.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Visual materials on this part
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {visual.length === 0 && <p className="text-xs text-stone-600">None named in the file.</p>}
          {visual.map((v) => (
            <span
              key={v.name}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800"
            >
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-stone-300"
                style={{ backgroundColor: v.colour }}
                aria-hidden="true"
              />
              {cleanVisualName(v.name)}
            </span>
          ))}
        </div>
        {selection.meshVolumeM3 != null && (
          <p className="text-xs text-stone-500">
            Mesh volume ≈ {volume(selection.meshVolumeM3)} in the file's own units, assuming metres
            and closed geometry.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label
          htmlFor="role-select"
          className="text-xs font-semibold uppercase tracking-wider text-stone-600"
        >
          What is this part?
        </label>
        <select
          id="role-select"
          value={role}
          onChange={(e) => setRole(e.target.value as ElementRole)}
          className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-800 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-3">
        <AiLabel model={state.status === 'ready' ? state.data.model : undefined} />
        {state.status === 'loading' && <InsightLoading message="Inferring the material…" />}
        {state.status === 'error' && <InsightError message={state.message} onRetry={retry} />}
        {state.status === 'ready' && (
          <div className="flex animate-fade-up flex-col gap-4">
            <p className="text-[15px] leading-relaxed text-stone-800">{state.data.description}</p>
            {state.data.disadvantages.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-base font-bold text-stone-900">Disadvantages</h4>
                <ul className="flex flex-col gap-2">
                  {state.data.disadvantages.map((c) => (
                    <li key={c} className="flex gap-2.5 text-[15px] leading-relaxed text-stone-800">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden="true" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="rounded-xl bg-stone-50 p-3.5 text-xs leading-relaxed text-stone-600">
              To get real quantities, costs and substitution deltas for your own building, the model
              needs to carry its material schedule — an IFC or BIM export rather than a glTF.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
