import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import EndOfPagePromos from '../components/EndOfPagePromos';
import { api } from '../lib/api';
import { useLanguage } from '../lib/i18n';

const WishlistPage = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState([]);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      const { data } = await api.wishlist.get();
      const prods = data.products || [];
      setProducts(prods);
      setWishlistIds(prods.map(p => p.id));
    } catch (error) {
      console.error('Failed to fetch wishlist', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen pt-4 pb-8 sm:pt-6 sm:pb-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold" data-testid="wishlist-page-title">My Wishlist</h1>
          <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">{products.length}</span> items</p>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-xl shadow-card p-12 text-center" data-testid="empty-wishlist">
            <Heart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Your wishlist is empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4" data-testid="wishlist-products">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} wishlistIds={wishlistIds} />
            ))}
          </div>
        )}
      </div>
      {/* Sponsored add-ons + Recommended (with interleaved sponsored carousels) */}
      <div className="pb-8" data-testid="wishlist-end-promos">
        <EndOfPagePromos excludeProductIds={wishlistIds} />
      </div>
    </div>
  );
};

export default WishlistPage;
