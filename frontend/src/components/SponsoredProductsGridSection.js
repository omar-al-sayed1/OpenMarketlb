import React, { useEffect, useState } from 'react';
import { Sparkles, Megaphone } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';

/**
 * End-of-page Sponsored Products section.
 * Shows ONLY on laptop (>= 1280px / `xl`), spans the WHOLE page width, and lays
 * out promoted products at 6 cards per row. Sponsored products arrive
 * "suggested first" from the backend (/promotions/active is engagement-sorted).
 */
const SponsoredProductsGridSection = ({
  title = 'Sponsored Products',
  subtitle = 'Recommended picks for you',
  limit = 12,
  excludeProductIds = [],
}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSponsored = async () => {
      try {
        const { data } = await api.promotions.getActive({ limit });
        let items = data.products || [];
        if (excludeProductIds.length > 0) {
          const excludeSet = new Set(excludeProductIds);
          items = items.filter((p) => !excludeSet.has(p.id));
        }
        setProducts(items);
      } catch (err) {
        console.error('Failed to load sponsored products');
      } finally {
        setLoading(false);
      }
    };
    fetchSponsored();
  }, [limit, excludeProductIds.length]);

  if (loading || products.length === 0) return null;

  return (
    /* hidden below xl → laptop-only */
    <div className="hidden xl:block w-full mt-10" data-testid="sponsored-products-section">
      <div className="w-full px-6 lg:px-10">
        {/* Sponsored header with clear "Ad" label */}
        <div className="mb-6 relative">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  {title}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 text-amber-700">
                  <Megaphone className="w-3 h-3" /> Ad
                </span>
              </div>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-500 rounded-full"></div>
        </div>

        {/* 6 cards per row on laptop */}
        <div className="grid grid-cols-6 gap-4">
          {products.map((product) => (
            <ProductCard key={`sponsored-${product.id}`} product={product} isSponsored={true} showShopName={true} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SponsoredProductsGridSection;
