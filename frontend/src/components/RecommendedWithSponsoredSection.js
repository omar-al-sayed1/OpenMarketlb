import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Compass, Sparkles, Heart } from 'lucide-react';
import ProductCard from './ProductCard';
import SponsoredRow from './SponsoredRow';
import { ProductCardSkeleton, LoadingMoreSpinner, EndOfListMessage } from './InfiniteScrollHelpers';
import { api } from '../lib/api';
import { useSponsoredSettings } from '../hooks/useSponsoredSettings';

/**
 * Recommended Products + interleaved Sponsored carousels.
 *
 * Mirrors the Products/Search page experience: organic ("recommended") products
 * are rendered in fixed-size blocks and a clearly-labelled "Sponsored picks"
 * carousel is inserted BETWEEN blocks. Each carousel gets a UNIQUE, non-overlapping
 * slice of sponsored products so items never repeat. Any sponsored products not
 * consumed by the in-between carousels are rendered as a final grid below once the
 * organic products run out — so no sponsored item is ever missed.
 *
 * Laptop-only (>= 1280px / `xl`), full page width, 6 cards per row — consistent
 * with the other end-of-page promotional sections across the app.
 */
const PAGE_SIZE = 18;
// Laptop tier (section is laptop-only): a clean 6-column grid.
const BLOCK_SIZE = 12; // 2 full rows of 6 organic products between carousels
const CARDS_PER_CAROUSEL = 6;
const CAROUSEL_THRESHOLD = 12;

const RecommendedWithSponsoredSection = ({
  title = 'Recommended Products',
  subtitle = 'Handpicked picks just for you',
  excludeProductIds = [],
  excludeShopId = null,
  pageSize = PAGE_SIZE,
}) => {
  const { sponsoredEnabledFor } = useSponsoredSettings();
  const adsEnabled = sponsoredEnabledFor('products');

  const [products, setProducts] = useState([]);
  const [boostedProducts, setBoostedProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const observerRef = useRef(null);
  const fetchedKeyRef = useRef('');

  const excludeKey = (excludeProductIds || []).slice().sort().join('|');

  // Wishlist (so heart icons reflect state) — fire and forget
  useEffect(() => {
    let mounted = true;
    api.wishlist
      .get()
      .then(({ data }) => {
        if (!mounted) return;
        setWishlistIds((data?.products || []).map((p) => p.id));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Sponsored / boosted products (over-fetch, filtered by exclusions)
  useEffect(() => {
    if (!adsEnabled) {
      setBoostedProducts([]);
      return;
    }
    let mounted = true;
    api.promotions
      .getActive({ limit: 40 })
      .then(({ data }) => {
        if (!mounted) return;
        let items = data.products || [];
        const ex = new Set(excludeProductIds || []);
        items = items.filter((p) => !ex.has(p.id));
        if (excludeShopId) items = items.filter((p) => p.shop_id !== excludeShopId);
        setBoostedProducts(items);
      })
      .catch(() => {
        if (mounted) setBoostedProducts([]);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adsEnabled, excludeKey, excludeShopId]);

  // Reset and fetch first page when exclude list changes
  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    fetchedKeyRef.current = '';
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excludeKey, excludeShopId]);

  // Fetch subsequent pages
  useEffect(() => {
    if (page > 1) fetchPage(page, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchPage = async (pageNum, isReset) => {
    const key = `${pageNum}|${excludeKey}|${excludeShopId || ''}`;
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;

    if (isReset) setLoading(true);
    else setLoadingMore(true);

    try {
      const { data } = await api.products.getAll({
        is_active: true,
        page: pageNum,
        limit: pageSize,
        sort_by: 'popular',
      });
      const items = (data.products || []).filter((p) => {
        if (excludeProductIds.includes(p.id)) return false;
        if (excludeShopId && p.shop_id === excludeShopId) return false;
        return true;
      });
      const totalCount = data.total ?? items.length;
      const hasMoreData = !!data.has_more;
      setTotal(totalCount);
      setProducts((prev) => (isReset ? items : [...prev, ...items]));
      setHasMore(hasMoreData);
    } catch (e) {
      console.error('Failed to load recommended products', e);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ---- Sponsored interleaving (same approach as the Products/Search page) ----
  const showSponsoredCarousels =
    adsEnabled && boostedProducts.length > 0 && products.length > CAROUSEL_THRESHOLD;

  const productBlocks = useMemo(() => {
    const blocks = [];
    for (let i = 0; i < products.length; i += BLOCK_SIZE) {
      blocks.push(products.slice(i, i + BLOCK_SIZE));
    }
    return blocks;
  }, [products]);

  const sponsoredSlices = useMemo(() => {
    const slices = {};
    if (!showSponsoredCarousels) return slices;
    let offset = 0;
    for (let b = 0; b < productBlocks.length; b++) {
      if (productBlocks[b].length !== BLOCK_SIZE) continue; // only after FULL blocks
      if (offset >= boostedProducts.length) break;
      const slice = boostedProducts.slice(offset, offset + CARDS_PER_CAROUSEL);
      if (slice.length === 0) break;
      slices[b] = slice;
      offset += CARDS_PER_CAROUSEL;
    }
    return slices;
  }, [showSponsoredCarousels, productBlocks, boostedProducts]);

  const sponsoredUsedCount = useMemo(
    () => Object.values(sponsoredSlices).reduce((sum, arr) => sum + arr.length, 0),
    [sponsoredSlices]
  );

  const leftoverSponsored = useMemo(() => {
    if (!adsEnabled || boostedProducts.length === 0) return [];
    return boostedProducts.slice(sponsoredUsedCount);
  }, [adsEnabled, boostedProducts, sponsoredUsedCount]);

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
      className="block w-full mt-8 sm:mt-10"
      data-testid="recommended-with-sponsored-section"
    >
      <div className="w-full px-3 sm:px-6 lg:px-10">
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

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4" data-testid="recommended-skeleton">
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
            {/* Block-based grid: organic products in blocks with a
                "Sponsored picks" carousel inserted after each full block. */}
            {productBlocks.map((block, bIdx) => {
              const picks = sponsoredSlices[bIdx] || [];
              const showCarouselAfter = picks.length > 0;
              return (
                <React.Fragment key={`reco-block-${bIdx}`}>
                  <div
                    className={`${bIdx === 0 ? '' : 'mt-4'} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4`}
                    data-testid={bIdx === 0 ? 'recommended-grid' : `recommended-grid-block-${bIdx}`}
                  >
                    {block.map((product) => (
                      <ProductCard
                        key={`reco-${product.id}`}
                        product={product}
                        wishlistIds={wishlistIds}
                        showShopName={true}
                      />
                    ))}
                  </div>

                  {showCarouselAfter && (
                    <div className="my-3" data-testid={`recommended-sponsored-picks-${bIdx}`}>
                      <SponsoredRow
                        surface="products"
                        title="Sponsored picks"
                        subtitle=""
                        variant="carousel"
                        products={picks}
                        limit={CARDS_PER_CAROUSEL}
                        compact={true}
                        data-testid={`recommended-sponsored-picks-row-${bIdx}`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Loading more skeleton */}
            {loadingMore && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <ProductCardSkeleton count={6} />
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {hasMore && !loadingMore && (
              <div ref={sentinelCallback} className="h-4" data-testid="recommended-sentinel" />
            )}

            {loadingMore && <LoadingMoreSpinner />}

            {/* End of list message */}
            {!hasMore && products.length > 0 && (
              <div className="mt-4">
                <EndOfListMessage total={total || products.length} />
              </div>
            )}

            {/* Remaining sponsored products below — only once organic products end
                and there are sponsored items not yet shown in the carousels above. */}
            {!hasMore && leftoverSponsored.length > 0 && (
              <div className="mt-6" data-testid="recommended-sponsored-leftover">
                <div className="mb-5 relative">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        More Sponsored Products
                      </h3>
                      <p className="text-xs text-slate-500">Promoted picks you may have missed</p>
                    </div>
                  </div>
                  <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-500 rounded-full"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {leftoverSponsored.map((product) => (
                    <ProductCard
                      key={`reco-sponsored-leftover-${product.id}`}
                      product={product}
                      wishlistIds={wishlistIds}
                      isSponsored={true}
                      showShopName={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default RecommendedWithSponsoredSection;
