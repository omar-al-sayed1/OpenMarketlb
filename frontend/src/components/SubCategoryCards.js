import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Grid3x3, FolderOpen } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Sub-category navigation cards displayed at the top of the products page.
 *
 * When the user is filtering by a single category (level 1 or 2), this component
 * fetches that category's children (with sample product images) and renders them
 * as compact, rounded cards that WRAP onto multiple rows (no horizontal swiping).
 * Clicking a card drills into that subcategory.
 */
const SubCategoryCards = ({ activeCategoryId }) => {
  const [, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null); // { parent, children }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCategoryId) { setData(null); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data: resp } = await api.categories.getChildrenWithPreview(activeCategoryId);
        if (!cancelled) setData(resp);
      } catch { if (!cancelled) setData(null); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [activeCategoryId]);

  const goToCategory = (catId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('category', catId);
      next.delete('categories');
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!activeCategoryId || loading) {
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
    return null;
  }

  if (!data || !data.children || data.children.length === 0) return null;

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
    <div className="mb-5 mt-1 px-3 sm:px-0" data-testid="subcategory-cards">
      {/* Simple header (no back button, no swipe arrows) */}
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <FolderOpen className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
        <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
          {data.parent?.name}
          <span className="ml-1.5 text-[11px] font-normal text-slate-400">· {data.children.length} subcategor{data.children.length === 1 ? 'y' : 'ies'}</span>
        </h3>
      </div>

      {/* Compact wrapped grid of subcategory cards (stacked rows, no horizontal scroll) */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
        {data.children.map((child, idx) => {
          const gradient = colors[idx % colors.length];
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => goToCategory(child.id)}
              className="group relative flex flex-col items-center gap-1 p-1 sm:p-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-violet-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
              data-testid={`subcategory-card-${child.id}`}
              aria-label={child.name}
            >
              {/* Thumbnail */}
              <div className="relative w-full aspect-square rounded-lg overflow-hidden">
                {child.preview_image ? (
                  <img
                    src={child.preview_image}
                    alt={child.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_55%)]" />
                    <Grid3x3 className="h-4 w-4 text-white/70" />
                  </div>
                )}
                {/* Product count badge */}
                {child.product_count > 0 && (
                  <span className="absolute top-0.5 right-0.5 px-1 py-px rounded-full bg-black/45 backdrop-blur-md text-white text-[8px] font-black tracking-wide">
                    {child.product_count}
                  </span>
                )}
                {/* Has-children chevron */}
                {child.has_children && (
                  <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/30">
                    <ChevronRight className="h-2 w-2" />
                  </span>
                )}
              </div>
              {/* Name */}
              <p className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 text-center leading-tight line-clamp-2 group-hover:text-violet-600 transition-colors">
                {child.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SubCategoryCards;
