import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useReveal — client-side "infinite scroll" over an already-fetched array.
 *
 * Many of our list endpoints return the FULL array in one shot, so the slowness
 * is not the network — it's rendering hundreds of rows/cards at once. This hook
 * reveals the data in small batches: it starts with `step` items and grows the
 * window by `step` each time the list nears its end, showing a brief skeleton
 * footer while the next batch "loads". The result feels like paginated loading
 * without any backend change.
 *
 * Usage:
 *   const { visible, hasMore, revealing, revealMore, reset } = useReveal(products, 8);
 *   <FlatList data={visible} onEndReached={revealMore} onEndReachedThreshold={0.5}
 *             ListFooterComponent={revealing ? <Skeletons/> : null} {...listPerfProps} />
 *
 * @param {Array}  data  the full array (from state)
 * @param {number} step  batch size (default 8)
 * @param {number} delay ms of skeleton before the next batch appears (default 350)
 */
export function useReveal(data, step = 8, delay = 350) {
  const arr = Array.isArray(data) ? data : [];
  const [count, setCount] = useState(step);
  const [revealing, setRevealing] = useState(false);
  const timer = useRef(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  // Whenever the underlying dataset changes (reload, filter, search) start over.
  useEffect(() => {
    setCount(step);
    setRevealing(false);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, [data, step]);

  const hasMore = count < arr.length;

  const revealMore = useCallback(() => {
    if (revealing || count >= arr.length) return; // busy, or nothing left to show
    setRevealing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!mounted.current) return;
      setCount((n) => Math.min(n + step, arr.length));
      setRevealing(false);
    }, delay);
  }, [revealing, count, arr.length, step, delay]);

  const reset = useCallback(() => setCount(step), [step]);

  return { visible: arr.slice(0, count), hasMore, revealing, revealMore, reset };
}

/**
 * Perf props to spread onto every FlatList so it virtualizes aggressively and
 * stays smooth while swiping. Keeps only a small window of rows mounted.
 */
export const listPerfProps = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: true,
};

export default useReveal;
