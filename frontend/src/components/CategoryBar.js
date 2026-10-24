import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, User, Baby, Sparkles, Grid3X3, Package, ImageIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useLanguage } from '../lib/i18n';

const CategoryBar = () => {
  const { language } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [typeCategoryMap, setTypeCategoryMap] = useState({ men: [], women: [], kids: [] });
  const barRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Helper to get category name based on language
  const getCatName = (cat) => language === 'ar' && cat.name_ar ? cat.name_ar : cat.name;

  useEffect(() => {
    fetchCategories();
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (barRef.current && !barRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getTree(true);
      setCategories(data.filter(c => c.is_active));
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  // Fetch products to build type → category mapping
  useEffect(() => {
    const buildTypeCatMap = async () => {
      try {
        const { data: products } = await api.products.getAll({ is_active: true });
        const map = { men: new Set(), women: new Set(), kids: new Set() };
        products.forEach(p => {
          const t = (p.type || '').toLowerCase();
          if (map[t] && p.category_ids) {
            p.category_ids.forEach(cid => map[t].add(cid));
          }
        });
        setTypeCategoryMap({
          men: [...map.men],
          women: [...map.women],
          kids: [...map.kids],
        });
      } catch {}
    };
    buildTypeCatMap();
  }, []);

  const handleTriggerEnter = (menuId) => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveMenu(menuId);
  };

  const handleTriggerLeave = () => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => setActiveMenu(null), 200);
  };

  const handleMenuEnter = () => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleMenuLeave = () => {
    if (isMobile) return;
    hoverTimeoutRef.current = setTimeout(() => setActiveMenu(null), 150);
  };

  const handleTriggerClick = (menuId) => {
    if (!isMobile) return;
    setActiveMenu(prev => prev === menuId ? null : menuId);
  };

  const handleNavigate = (path) => {
    setActiveMenu(null);
    navigate(path);
  };

  // Type filters
  const typeFilters = [
    { id: 'men', label: 'Men', icon: User, gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700' },
    { id: 'women', label: 'Women', icon: Sparkles, gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-50', text: 'text-pink-700' },
    { id: 'kids', label: 'Kids', icon: Baby, gradient: 'from-amber-400 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  ];

  // Default category images
  const defaultCategoryImages = {
    'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=300&fit=crop',
    'Footwear': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop',
    'Fashion': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=300&fit=crop',
    'Home & Living': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&h=300&fit=crop',
  };

  // Render mega menu for L1 category
  const renderCategoryMegaMenu = (category) => {
    const l2Categories = category.children?.filter(c => c.is_active) || [];
    const categoryImage = category.image || defaultCategoryImages[category.name] || null;
    
    return (
      <div className="absolute left-0 right-0 top-full z-50" onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 pt-2">
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row">
              {/* Left - Category Hero */}
              <div className="w-full md:w-56 lg:w-64 relative overflow-hidden">
                {categoryImage ? (
                  <>
                    <img src={categoryImage} alt={getCatName(category)} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/40" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-700" />
                )}
                <div className="relative p-5 h-full flex flex-col justify-end min-h-[160px]">
                  <h3 className="text-xl font-extrabold text-white tracking-tight">{getCatName(category)}</h3>
                  <p className="text-white/60 text-xs mt-1 mb-4">{l2Categories.length} subcategories</p>
                  <button
                    onClick={() => handleNavigate(`/products?category=${category.id}`)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg px-4 py-2 transition-all border border-white/10"
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                    View All
                  </button>
                </div>
              </div>

              {/* Right - Subcategories */}
              <div className="flex-1 p-4 sm:p-5">
                {l2Categories.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {l2Categories.map((l2) => {
                      const l3Categories = l2.children?.filter(c => c.is_active) || [];
                      return (
                        <div key={l2.id}>
                          <button
                            onClick={() => handleNavigate(`/products?category=${l2.id}`)}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-violet-50 transition-all group"
                          >
                            <span className="font-semibold text-sm text-slate-700 group-hover:text-violet-600 flex items-center gap-1">
                              {l2.name}
                              <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-violet-500" />
                            </span>
                          </button>
                          {l3Categories.length > 0 && (
                            <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-3">
                              {l3Categories.map((l3) => (
                                <button
                                  key={l3.id}
                                  onClick={() => handleNavigate(`/products?category=${l3.id}`)}
                                  className="block text-xs text-slate-400 hover:text-violet-600 py-0.5 transition-colors"
                                >
                                  {l3.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 py-6">
                    <div className="text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">Browse all {getCatName(category).toLowerCase()} products</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render mega menu for type filter (Men/Women/Kids)
  const renderTypeMegaMenu = (type) => {
    return (
      <div className="absolute left-0 right-0 top-full z-50" onMouseEnter={handleMenuEnter} onMouseLeave={handleMenuLeave}>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 pt-2">
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.12)] border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col md:flex-row">
              {/* Left - Type Info */}
              <div className={`w-full md:w-56 lg:w-64 bg-gradient-to-br ${type.gradient} p-5 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm border border-white/10">
                    <type.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight">{type.label}'s</h3>
                  <p className="text-white/60 text-xs mt-1 mb-4">Shop the latest {type.label.toLowerCase()}'s fashion</p>
                  <button
                    onClick={() => handleNavigate(`/products?type=${type.id}`)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg px-4 py-2 transition-all border border-white/10"
                  >
                    <Package className="h-3.5 w-3.5" />
                    View All
                  </button>
                </div>
              </div>

              {/* Right - Categories */}
              <div className="flex-1 p-4 sm:p-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3">Shop by Category</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {/* Show ALL level-1 categories for the hovered style (men/women/kids) */}
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleNavigate(`/products?category=${cat.id}&type=${type.id}`)}
                      className="px-3 py-2.5 rounded-xl hover:bg-violet-50 transition-all text-left group"
                    >
                      <p className="font-semibold text-sm text-slate-700 group-hover:text-violet-600 flex items-center gap-1">
                        {getCatName(cat)}
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-violet-500" />
                      </p>
                      <p className="text-[10px] text-slate-400">{type.label}'s {getCatName(cat).toLowerCase()}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (categories.length === 0) return null;

  return (
    <div 
      ref={barRef}
      className="fixed top-11 sm:top-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80"
      data-testid="category-bar"
    >
      <div className="max-w-[1600px] mx-auto px-2 sm:px-3 lg:px-5">
        {/* Scrollable container for mobile swipe */}
        <div className="flex items-center gap-0.5 h-9 overflow-x-auto scrollbar-hide scroll-smooth">
          {/* L1 Categories */}
          {categories.map((cat) => (
            <div key={cat.id} className="relative flex-shrink-0">
              <button
                onClick={() => handleTriggerClick(cat.id)}
                onMouseEnter={() => handleTriggerEnter(cat.id)}
                onMouseLeave={handleTriggerLeave}
                className={`flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 lg:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  activeMenu === cat.id
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                data-testid={`category-bar-${cat.id}`}
              >
                {getCatName(cat)}
                <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform duration-200 ${activeMenu === cat.id ? 'rotate-180' : ''}`} />
              </button>
            </div>
          ))}

          {/* Separator */}
          <div className="h-6 w-px bg-slate-200 mx-2 flex-shrink-0" />

          {/* Type Filters */}
          {typeFilters.map((type) => (
            <div key={type.id} className="relative flex-shrink-0">
              <button
                onClick={() => handleTriggerClick(type.id)}
                onMouseEnter={() => handleTriggerEnter(type.id)}
                onMouseLeave={handleTriggerLeave}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 lg:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                  activeMenu === type.id
                    ? `${type.bg} ${type.text}`
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                data-testid={`category-bar-type-${type.id}`}
              >
                <type.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {type.label}
                <ChevronDown className={`h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform duration-200 ${activeMenu === type.id ? 'rotate-180' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Mega Menu Overlay (click to close) */}
      {activeMenu && (
        <div 
          className="fixed inset-0 top-28 bg-black/10 z-30"
          onClick={() => setActiveMenu(null)}
        />
      )}

      {/* Render appropriate mega menu */}
      {activeMenu && categories.find(c => c.id === activeMenu) && (
        renderCategoryMegaMenu(categories.find(c => c.id === activeMenu))
      )}
      {activeMenu && typeFilters.find(t => t.id === activeMenu) && (
        renderTypeMegaMenu(typeFilters.find(t => t.id === activeMenu))
      )}

      {/* Custom scrollbar hide styles */}
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default CategoryBar;
