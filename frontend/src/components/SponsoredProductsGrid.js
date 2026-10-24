import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';

const SponsoredProductsGrid = ({ categoryId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSponsored = async () => {
      try {
        const params = { limit: 20 };
        if (categoryId) params.category_id = categoryId;
        const { data } = await api.promotions.getActive(params);
        setProducts(data.products || []);
      } catch (err) {
        console.error('Failed to load sponsored products');
      } finally {
        setLoading(false);
      }
    };
    fetchSponsored();
  }, [categoryId]);

  if (loading || products.length === 0) return null;

  return (
    <div data-testid="sponsored-products-grid" className="overflow-hidden">
      <div className="flex items-center gap-2 mb-4 px-3 sm:px-0">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full border border-amber-200">
          <Megaphone className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">Sponsored</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0 sm:gap-3 mobile-products-grid overflow-hidden">
        {products.map(product => (
          <ProductCard key={product.id} product={product} isSponsored={true} showShopName={true} />
        ))}
      </div>
    </div>
  );
};

export default SponsoredProductsGrid;
