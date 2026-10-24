import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';

const ProductRecommendations = ({ productId, title = 'Customers Also Bought', showShopName = false }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data } = await api.recommendations.forProduct(productId);
        setProducts(data.products || []);
      } catch (err) {
        console.error('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };
    if (productId) fetchRecommendations();
  }, [productId]);

  if (loading || products.length === 0) return null;

  return (
    <div className="mt-12" data-testid="product-recommendations">
      <div className="flex items-center gap-2 mb-6 px-3 sm:px-0">
        <Sparkles className="w-5 h-5 text-violet-600" />
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-0 sm:gap-3">
        {products.slice(0, 12).map(product => (
          <ProductCard key={product.id} product={product} showShopName={showShopName} />
        ))}
      </div>
    </div>
  );
};

export default ProductRecommendations;
