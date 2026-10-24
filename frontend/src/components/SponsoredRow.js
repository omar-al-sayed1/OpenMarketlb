import React, { useEffect, useState } from 'react';
import { Megaphone, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';
import { useSponsoredSettings } from '../hooks/useSponsoredSettings';

/**
 * Versatile sponsored/boosted products row.
 *
 * Renders a clearly-labelled ("Ad"/"Sponsored") band of promoted products that
 * can target a category, exclude specific products/shops, and lay out either as a
 * horizontal carousel or a responsive grid.
 *
 * Visibility is gated by admin placement toggles via `surface`.
 *
 * Props:
 *  - surface (string)            : gating key (products | product_detail | cart_checkout | category_band | shop_public)
 *  - title (string)              : heading text
 *  - subtitle (string)           : small caption under heading
 *  - categoryId (string)         : only show sponsored products in this category
 *  - excludeProductIds (array)   : product ids to drop
 *  - excludeShopId (string)      : drop products belonging to this shop
 *  - limit (number)              : max products to show (default 8)
 *  - variant ('carousel'|'grid') : layout (default 'carousel')
 *  - cardWidth (string)          : tailwind width for carousel cards (default w-[150px] sm:w-[185px])
 *  - accent ('amber'|'violet')   : color accent
 *  - products (array)            : OPTIONAL pre-fetched products (skips fetching)
 *  - lowPriceFirst (bool)        : sort cheaper items first (good for add-ons)
 */
const SponsoredRow = ({
  surface,
  title = 'Sponsored',
  subtitle = '',
  categoryId = null,
  categoryIds = null,
  excludeProductIds = [],
  excludeShopId = null,
  limit = 8,
  variant = 'carousel',
  cardWidth = 'w-[150px] sm:w-[185px]',
  accent = 'amber',
  products: providedProducts = null,
  lowPriceFirst = false,
  strictShopExclude = false,
  compact = false,
  hideShopName = false,
  gridColsClass = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  'data-testid': dataTestId,
}) => {
  const { sponsoredEnabledFor, loaded } = useSponsoredSettings();
  const [products, setProducts] = useState(providedProducts || []);
  const [loading, setLoading] = useState(!providedProducts);
  const scrollRef = React.useRef(null);

  const enabled = sponsoredEnabledFor(surface);
  const excludeKey = (excludeProductIds || []).join(',');
  const categoryIdsKey = (categoryIds || []).join(',');

  useEffect(() => {
    // If products are supplied by parent, just apply filters/limits locally.
    if (providedProducts) {
      let items = [...providedProducts];
      if (excludeProductIds.length) {
        const ex = new Set(excludeProductIds);
        items = items.filter((p) => !ex.has(p.id));
      }
      if (excludeShopId) items = items.filter((p) => p.shop_id !== excludeShopId);
      setProducts(items.slice(0, limit));
      setLoading(false);
      return;
    }

    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const fetchSponsored = async () => {
      try {
        // Over-fetch so client-side filters still leave enough items.
        const { data } = await api.promotions.getActive({ limit: 40 });
        const all = data.products || [];

        const exProd = new Set(excludeProductIds || []);
        const base = all.filter((p) => !exProd.has(p.id));
        // Match against a whole family of category IDs (categoryIds) when provided,
        // otherwise fall back to the single categoryId.
        const matchCats =
          categoryIds && categoryIds.length
            ? categoryIds
            : categoryId
            ? [categoryId]
            : null;
        const inCategory = (p) => {
          if (!matchCats) return true;
          const cats = [p.category_id, ...(p.category_ids || [])].filter(Boolean);
          return cats.some((c) => matchCats.includes(c));
        };
        const notThisShop = (p) => !excludeShopId || p.shop_id !== excludeShopId;

        // Graceful fallback chain so a relevant band still renders:
        //   1) category + other-shops
        //   2) relax (either shop or category depending on strictShopExclude)
        //   3) any sponsored (excluding the current product)
        let items = base.filter((p) => inCategory(p) && notThisShop(p));
        if (items.length === 0) {
          items = strictShopExclude
            ? base.filter(notThisShop) // keep shop exclusion, drop category
            : base.filter(inCategory); // keep category, allow same shop
        }
        if (items.length === 0) {
          items = strictShopExclude ? base.filter(notThisShop) : base;
        }

        if (lowPriceFirst) {
          items = [...items].sort(
            (a, b) => (a.discount_price || a.price) - (b.discount_price || b.price)
          );
        }
        if (mounted) setProducts(items.slice(0, limit));
      } catch (err) {
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchSponsored();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, categoryId, categoryIdsKey, excludeShopId, excludeKey, limit, lowPriceFirst, strictShopExclude, providedProducts]);

  if (!loaded && !providedProducts) return null;
  if (!enabled) return null;
  if (loading) return null;
  if (!products || products.length === 0) return null;

  const accentClasses =
    accent === 'violet'
      ? {
          icon: 'from-violet-500 to-indigo-600',
          chip: 'from-violet-100 to-indigo-100 border-violet-200 text-violet-700',
          title: 'from-violet-600 to-indigo-600',
          bar: 'from-violet-400 to-indigo-500',
        }
      : {
          icon: 'from-amber-400 to-orange-500',
          chip: 'from-amber-100 to-orange-100 border-amber-200 text-amber-700',
          title: 'from-amber-600 to-orange-600',
          bar: 'from-amber-400 to-orange-500',
        };

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const Header = (
    <div className="flex items-center justify-between mb-4 px-3 sm:px-0">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${accentClasses.icon} flex items-center justify-center shadow-lg shadow-amber-500/20`}
        >
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className={`text-base sm:text-lg font-bold bg-gradient-to-r ${accentClasses.title} bg-clip-text text-transparent truncate`}
            >
              {title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r ${accentClasses.chip} border`}
            >
              <Megaphone className="w-3 h-3" /> Ad
            </span>
          </div>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      {variant === 'carousel' && products.length > 2 && (
        <div className="hidden sm:flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => scroll(-1)}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-amber-300 flex items-center justify-center text-slate-500 hover:text-amber-600 transition-all shadow-sm"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-amber-300 flex items-center justify-center text-slate-500 hover:text-amber-600 transition-all shadow-sm"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full" data-testid={dataTestId || `sponsored-row-${surface}`}>
      {Header}
      {variant === 'grid' ? (
        <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
          {products.map((product) => (
            <ProductCard
              key={`spon-${surface}-${product.id}`}
              product={product}
              isSponsored={true}
              showShopName={!hideShopName}
              hideShopName={hideShopName}
              compact={compact}
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <div
              key={`spon-${surface}-${product.id}`}
              className={`flex-shrink-0 ${cardWidth} snap-start`}
            >
              <ProductCard product={product} isSponsored={true} showShopName={!hideShopName} hideShopName={hideShopName} compact={compact} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SponsoredRow;
