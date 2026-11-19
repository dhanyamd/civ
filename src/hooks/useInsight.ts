import { useCallback, useEffect, useState } from 'react';

export type InsightState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

/**
 * Results live at module scope, not inside the hook.
 *
 * Switching between Details and Optimise unmounts one panel and mounts the
 * other, so a cache held in a ref would die with the component and every tab
 * switch would pay for a fresh model call. Keeping it here means an answer is
 * fetched once per element and material for the life of the page.
 */
const cache = new Map<string, unknown>();

/**
 * Requests already in flight, so two mounts of the same key share one call and
 * a tab switch mid-request does not start a second one.
 */
const inflight = new Map<string, Promise<unknown>>();

/** Clear everything — used when the model changes and old answers no longer apply. */
export function clearInsightCache() {
  cache.clear();
  inflight.clear();
}

export function useInsight<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<InsightState<T>>(() =>
    cache.has(key) ? { status: 'ready', data: cache.get(key) as T } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(key)) {
      setState({ status: 'ready', data: cache.get(key) as T });
      return;
    }

    // Unmounting must not cancel the request: the user may simply have flipped
    // tabs, and the answer is still wanted when they flip back.
    let active = true;
    setState({ status: 'loading' });

    let promise = inflight.get(key) as Promise<T> | undefined;
    if (!promise) {
      promise = fetcher(new AbortController().signal)
        .then((data) => {
          cache.set(key, data);
          return data;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, promise);
    }

    promise
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong. Please retry.',
        });
      });

    return () => {
      active = false;
    };
    // `fetcher` is memoised by the caller against this same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => {
    cache.delete(key);
    inflight.delete(key);
    setAttempt((n) => n + 1);
  }, [key]);

  return { state, retry };
}
