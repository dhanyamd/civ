import { AlertTriangle, Loader2, RotateCcw, Sparkles } from 'lucide-react';

export function InsightLoading({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-700" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function InsightError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-amber-900">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

/** Marks a block as model-written rather than calculated. */
export function AiLabel({ model }: { model?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      <span>Engineering review{model ? ` · ${model.split('/').pop()}` : ''}</span>
    </div>
  );
}
