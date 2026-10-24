import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Grid3x3, LayoutGrid } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Top-level (Level 1) category cards shown at the top of the products page
 * when browsing ALL products (no category filter selected).
 *
 * Compact, rounded cards that WRAP onto multiple rows (no horizontal swiping).
 * Clicking a card filters the products by that category.
 */
const CategoryCards = () => {
  const [, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.categories.getTopLevelWithPreview();
        if (!cancelled) setCategories(data.categories || []);
      } catch { if (!cancelled) setCategories([]); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const goToCategory = (catId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('category', catId);
      next.delete('categories');
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="mb-5 mt-1 px-3 sm:px-0">
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }

  if (!categories.length) return null;

  const colors = [
    'from-violet-500 to-fuchsia-500',
    'from-rose-500 to-orange-500',
    'from-emerald-500 to-teal-500',
    'from-blue-500 to-indigo-500',
    'from-amber-500 to-yellow-500',
    'from-pink-500 to-rose-500',
    'from-cyan-500 to-blue-500',
    'from-purple-500 to-pink-500',
  ];

  return (
    <div className="mb-5 mt-1 px-3 sm:px-0" data-testid="category-cards">
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <LayoutGrid className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
        <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
          Shop by Category
          <span className="ml-1.5 text-[11px] font-normal text-slate-400">· {categories.length} categories</span>
        </h3>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
        {categories.map((cat, idx) => {
          const gradient = colors[idx % colors.length];
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => goToCategory(cat.id)}
              className="group relative flex flex-col items-center gap-1 p-1 sm:p-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-violet-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              data-testid={`category-card-${cat.id}`}
              aria-label={cat.name}
            >
              <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                {cat.preview_image ? (
                  <img
                    src={cat.preview_image}
                    alt={cat.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  // No photo → lighter / smaller centered gradient chip (looks smaller)
                  <div className="w-full h-full bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                    <div className={`relative w-1/2 h-1/2 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105`}>
                      <div className="absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                      <Grid3x3 className="h-3 w-3 text-white/85" />
                    </div>
                  </div>
                )}
                {cat.product_count > 0 && (
                  <span className="absolute top-0.5 right-0.5 px-1 py-px rounded-full bg-black/45 backdrop-blur-md text-white text-[8px] font-black tracking-wide">
                    {cat.product_count}
                  </span>
                )}
                {cat.has_children && (
                  <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
                    <ChevronRight className="h-2 w-2" />
                  </span>
                )}
              </div>
              <p className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 text-center leading-tight line-clamp-2 group-hover:text-violet-600 transition-colors">
                {cat.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryCards;
