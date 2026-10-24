import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Brain, Eye, Heart, ShoppingCart } from 'lucide-react';
import ProductCard from './ProductCard';
import { api } from '../lib/api';
import { useLanguage } from '../lib/i18n';

const PersonalizedRecommendations = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [type, setType] = useState('trending');
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const { data } = await api.recommendations.personalized();
        setProducts(data.products || []);
        setType(data.type || 'trending');
        setSignals(data.signals || null);
      } catch (err) {
        console.error('Failed to load personalized recommendations');
      } finally {
        setLoading(false);
      }
    };
    fetchRecs();
  }, []);

  if (loading || products.length === 0) return null;

  const isPersonalized = type === 'personalized';

  return (
    <div className="mb-8" data-testid="personalized-recommendations">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isPersonalized ? (
            <>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{t('home.recommendedForYou')}</h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('home.basedOnActivity')}</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{t('home.trendingProducts')}</h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('home.mostPopular')}</p>
              </div>
            </>
          )}
        </div>
        {/* AI signal indicators */}
        {isPersonalized && signals && (
          <div className="hidden sm:flex items-center gap-2">
            {signals.views > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-medium">
                <Eye className="h-2.5 w-2.5" /> {signals.views} {t('home.views')}
              </span>
            )}
            {signals.wishlist > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-medium">
                <Heart className="h-2.5 w-2.5" /> {signals.wishlist} {t('home.liked')}
              </span>
            )}
            {signals.purchases > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-medium">
                <ShoppingCart className="h-2.5 w-2.5" /> {signals.purchases} {t('home.bought')}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 px-1 sm:px-0">
        {products.slice(0, 10).map(product => (
          <ProductCard key={product.id} product={product} showShopName={true} />
        ))}
      </div>
    </div>
  );
};

export default PersonalizedRecommendations;
