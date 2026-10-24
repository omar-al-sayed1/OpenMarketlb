import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Compass, Sparkles, Heart } from 'lucide-react';
import ProductCard from './ProductCard';
import { ProductCardSkeleton, LoadingMoreSpinner, EndOfListMessage } from './InfiniteScrollHelpers';
import { api } from '../lib/api';

/**
 * Recommended Products Section
 * Reusable section shown below the Sponsored Products on multiple pages.
 * Features:
 *  - Skeleton loading on first load
 *  - Infinite scroll using IntersectionObserver
 *  - Uses same ProductCard component as Products page so cards look identical
 */
const PAGE_SIZE = 12;

const RecommendedProductsSection = ({
  title = 'Recommended Products',
  subtitle = 'Handpicked picks just for you',
  excludeProductIds = [],
  excludeShopId = null,
  categoryIds = [],
  pageSize = PAGE_SIZE,
}) => {
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const observerRef = useRef(null);

  // Build an exclusion key so we can re-fetch when excludeProductIds change at the parent level
  const excludeKey = (excludeProductIds || []).slice().sort().join('|');
  // Cart categories → products sharing one show first ("similar"), then everyone else.
  const catParam = (categoryIds || []).slice().sort().join(',');
  const phaseRef = useRef('others');     // 'similar' → 'others'
  const phasePageRef = useRef(1);        // page within the current phase
  const shownIdsRef = useRef(new Set()); // similar ids already shown (dedupe in 'others')
  const loadingRef = useRef(false);      // guard against overlapping fetches

  // Wishlist (so heart icons reflect state) — fire and forget
  useEffect(() => {
    let mounted = true;
    api.wishlist.get()
      .then(({ data }) => {
        if (!mounted) return;
        setWishlistIds((data?.products || []).map((p) => p.id));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Reset and fetch first batch when the cart (exclude list / categories) changes
  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    phaseRef.current = catParam ? 'similar' : 'others';
    phasePageRef.current = 1;
    shownIdsRef.current = new Set();
    loadBatch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeKey, excludeShopId, catParam]);

  // Load more when the sentinel advances the page
  useEffect(() => {
    if (page > 1) loadBatch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const passes = (p) => {
    if (excludeProductIds.includes(p.id)) return false;
    if (excludeShopId && p.shop_id === excludeShopId) return false;
    return true;
  };

  // Two-phase load: exhaust products that share a cart category ("similar"), then
  // continue with all other products in recommended order. No reordering/reflow.
  const loadBatch = async (isReset) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (isReset) setLoading(true);
    else setLoadingMore(true);
    try {
      let collected = [];
      // Up to two attempts so a similar→others hand-off fills the row in one go.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const phase = phaseRef.current;
        const pPage = phasePageRef.current;
        const params = { is_active: true, page: pPage, limit: pageSize }; // no sort_by → recommended
        if (phase === 'similar') params.category_ids = catParam;
        // eslint-disable-next-line no-await-in-loop
        const { data } = await api.products.getAll(params);
        const items = (data.products || []).filter((p) => {
          if (!passes(p)) return false;
          if (phase === 'others' && shownIdsRef.current.has(p.id)) return false; // dedupe
          return true;
        });
        if (phase === 'similar') items.forEach((p) => shownIdsRef.current.add(p.id));
        collected = collected.concat(items);
        setTotal(data.total ?? 0);
        if (data.has_more) { phasePageRef.current = pPage + 1; setHasMore(true); break; }
        if (phase === 'similar') {
          // similar exhausted → switch to everyone else; keep going to fill the row
          phaseRef.current = 'others';
          phasePageRef.current = 1;
          setHasMore(true);
          if (collected.length < pageSize) continue; // eslint-disable-line no-continue
          break;
        }
        setHasMore(false); // others exhausted
        break;
      }
      setProducts((prev) => (isReset ? collected : [...prev, ...collected]));
    } catch (e) {
      console.error('Failed to load recommended products', e);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const sentinelCallback = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
            setPage((prev) => prev + 1);
          }
        },
        { threshold: 0.1, rootMargin: '400px' }
      );
      if (node) observerRef.current.observe(node);
    },
    [hasMore, loading, loadingMore]
  );

  return (
    <section
      className="hidden xl:block w-full mt-8 sm:mt-10"
      data-testid="recommended-products-section"
    >
      <div className="w-full px-6 lg:px-10">
        {/* Header — distinct from Sponsored (uses violet/indigo gradient) */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  {title}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  <Sparkles className="h-2.5 w-2.5" />
                  For You
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-violet-400 via-purple-500 to-indigo-500 rounded-full"></div>
        </div>

        {/* Grid — 6 cards per row on laptop */}
        {loading ? (
          <div
            className="grid grid-cols-6 gap-4"
            data-testid="recommended-skeleton"
          >
            <ProductCardSkeleton count={12} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center">
              <Heart className="h-6 w-6 text-violet-400" />
            </div>
            <p className="text-slate-600 text-sm font-medium">No recommendations yet</p>
            <p className="text-slate-400 text-xs mt-1">Browse more products to get personalised picks.</p>
          </div>
        ) : (
          <>
            <div
              className="grid grid-cols-6 gap-4"
              data-testid="recommended-grid"
            >
              {products.map((product) => (
                <ProductCard
                  key={`reco-${product.id}`}
                  product={product}
                  wishlistIds={wishlistIds}
                  showShopName={true}
                />
              ))}
              {loadingMore && <ProductCardSkeleton count={6} />}
            </div>

            {hasMore && !loadingMore && (
              <div ref={sentinelCallback} className="h-4" data-testid="recommended-sentinel" />
            )}

            {loadingMore && <LoadingMoreSpinner />}

            {!hasMore && products.length > 0 && (
              <div className="mt-4">
                <EndOfListMessage total={total || products.length} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default RecommendedProductsSection;
