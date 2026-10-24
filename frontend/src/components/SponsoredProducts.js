import React, { useEffect, useState, useRef } from 'react';
import { Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';

const SponsoredProducts = ({ categoryId }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

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

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  return (
    <div data-testid="sponsored-products" className="overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full border border-amber-200">
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Sponsored</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:border-amber-300 flex items-center justify-center text-gray-500 hover:text-amber-600 transition-all shadow-sm">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full bg-white border border-gray-200 hover:border-amber-300 flex items-center justify-center text-gray-500 hover:text-amber-600 transition-all shadow-sm">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide" 
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', margin: 0 }}
      >
        {products.map(product => (
          <div key={product.id} className="flex-shrink-0 w-[180px] sm:w-[220px] snap-start relative">
            <ProductCard product={product} isSponsored={true} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SponsoredProducts;
