import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';

const BoostedProductsStrip = ({ title = 'Sponsored Products', maxCount = 8, showShopName = false, cols = 6, fullWidth = false }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.promotions.getActive({ limit: maxCount });
        setProducts(data.products || []);
      } catch (e) {} finally { setLoading(false); }
    };
    fetch();
  }, [maxCount]);

  if (loading || products.length === 0) return null;

  return (
    <div className={`py-8 bg-gradient-to-r from-amber-50/50 to-orange-50/50 ${fullWidth ? 'w-full overflow-hidden' : ''}`} data-testid="boosted-products-strip">
      <div className={fullWidth ? 'max-w-screen-2xl mx-auto px-3 sm:px-5 lg:px-8' : 'w-full px-3 sm:px-5 lg:px-6'}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full border border-amber-200">
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Sponsored</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${cols === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-6'} gap-3`}>
          {products.slice(0, maxCount).map(product => (
            <ProductCard key={product.id} product={product} showShopName={showShopName} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BoostedProductsStrip;
