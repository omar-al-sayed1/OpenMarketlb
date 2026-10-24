import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for infinite scroll with skeleton loading
 * @param {Function} fetchFn - Async function that takes (page, limit) and returns { items, hasMore }
 * @param {number} limit - Items per page
 * @param {Array} deps - Dependencies that reset the list
 */
const useInfiniteScroll = (fetchFn, limit = 12, deps = []) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const abortRef = useRef(null);

  // Reset when deps change
  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setTotal(0);
  }, deps);

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const result = await fetchFn(page, limit);
        if (cancelled) return;

        if (page === 1) {
          setItems(result.items || []);
        } else {
          setItems(prev => [...prev, ...(result.items || [])]);
        }
        setHasMore(result.hasMore ?? false);
        setTotal(result.total ?? 0);
      } catch (err) {
        if (!cancelled) console.error('Infinite scroll fetch error:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [page, ...deps]);

  // Intersection observer for sentinel element
  const setSentinel = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (node) observerRef.current.observe(node);
    sentinelRef.current = node;
  }, [hasMore, loading, loadingMore]);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    total,
    setSentinel,
    page,
  };
};

export default useInfiniteScroll;
