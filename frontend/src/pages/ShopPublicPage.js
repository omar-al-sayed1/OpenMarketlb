import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, Package, Mail, Phone, MapPin, Shield, Search, SlidersHorizontal, X, ArrowRight, Share2, Star, Eye, TrendingUp, Sparkles, BadgeCheck, Tag, Clock, Percent, Images } from 'lucide-react';
import CategoryTreeFilter from '../components/CategoryTreeFilter';
import VariantFilters from '../components/VariantFilters';
import { ProductCardSkeleton, LoadingMoreSpinner, EndOfListMessage } from '../components/InfiniteScrollHelpers';
import { api } from '../lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useLanguage } from '../lib/i18n';
import { getThemeConfig } from '../lib/themes';
import SponsoredRow from '../components/SponsoredRow';
import { getThemedCard } from '../components/ThemedProductCards';
import LightboxViewer from '../components/LightboxViewer';

const ShopPublicPage = () => {
  const { t } = useLanguage();
  const { shopId } = useParams();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allCategories, setAllCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [discountRange, setDiscountRange] = useState([0, 100]);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedShapes, setSelectedShapes] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sortBy, setSortBy] = useState('default');
  const [sponsoredProducts, setSponsoredProducts] = useState([]);
  const [activeSale, setActiveSale] = useState(null);
  const [showSalePopup, setShowSalePopup] = useState(false);
  const [gallery, setGallery] = useState([]);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const shopFiltersSidebarRef = useRef(null);

  // Lock body scroll when mobile filters are open
  useEffect(() => {
    if (showMobileFilters || galleryModalOpen || lightboxIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showMobileFilters, galleryModalOpen, lightboxIndex]);

  useEffect(() => {
    fetchShopData();
    fetchWishlist();
    fetchSponsored();
    fetchActiveSale();
    fetchGallery();
  }, [shopId]);

  const fetchShopData = async () => {
    try {
      const [shopRes, productsRes, catRes] = await Promise.allSettled([
        api.shops.getById(shopId),
        api.shops.getProducts(shopId),
        api.categories.getTree(true)
      ]);
      if (shopRes.status === 'fulfilled') setShop(shopRes.value.data);
      if (catRes.status === 'fulfilled') setAllCategories(catRes.value.data.filter(c => c.is_active));
      if (productsRes.status === 'fulfilled') {
        const prods = productsRes.value.data;
        setProducts(prods);
        if (prods.length > 0) {
          const max = Math.ceil(Math.max(...prods.map(p => p.price || 0)));
          setMaxPrice(max || 1000);
          setPriceRange([0, max || 1000]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch shop', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlist = async () => {
    try { const { data } = await api.wishlist.get(); setWishlistIds(data.products?.map(p => p.id) || []); } catch {}
  };

  const fetchSponsored = async () => {
    try { const { data } = await api.promotions.getActive({ limit: 10 }); setSponsoredProducts(data.products || []); } catch {}
  };

  const fetchActiveSale = async () => {
    try {
      const { data } = await api.shops.getActiveSale(shopId);
      setActiveSale(data);
      if (data && data.is_active) {
        const popupKey = `shop_sale_popup_${shopId}_${data.id}`;
        if (!sessionStorage.getItem(popupKey)) {
          setTimeout(() => {
            setShowSalePopup(true);
            sessionStorage.setItem(popupKey, 'true');
          }, 800);
        }
      }
    } catch {}
  };

  const fetchGallery = async () => {
    try {
      const { data } = await api.shops.getGallery(shopId);
      setGallery(data.gallery || []);
    } catch {}
  };

  const shopCategoryIds = useMemo(() => {
    const catIds = new Set();
    products.forEach(p => { if (p.category_id) catIds.add(p.category_id); (p.category_ids || []).forEach(id => catIds.add(id)); });
    return catIds;
  }, [products]);

  const shopCategoryTree = useMemo(() => {
    const filterTree = (nodes) => nodes.reduce((acc, node) => {
      const filteredChildren = node.children ? filterTree(node.children) : [];
      if (shopCategoryIds.has(node.id) || filteredChildren.length > 0) acc.push({ ...node, children: filteredChildren });
      return acc;
    }, []);
    return filterTree(allCategories);
  }, [allCategories, shopCategoryIds]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (search.trim()) { const q = search.toLowerCase(); result = result.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)); }
    result = result.filter(p => { const price = p.discount_price || p.price; return price >= priceRange[0] && price <= priceRange[1]; });
    if (discountRange[0] > 0 || discountRange[1] < 100) {
      result = result.filter(p => {
        if (!p.discount_price || p.discount_price >= p.price) return discountRange[0] === 0;
        const pct = Math.round(((p.price - p.discount_price) / p.price) * 100);
        return pct >= discountRange[0] && pct <= discountRange[1];
      });
    }
    if (selectedType !== 'all') result = result.filter(p => p.type === selectedType);
    if (selectedColors.length > 0) {
      const lcColors = selectedColors.map(c => c.toLowerCase());
      result = result.filter(p => (p.colors || []).some(c => lcColors.includes((c.color_name || '').toLowerCase())));
    }
    if (selectedSizes.length > 0) {
      const lcSizes = selectedSizes.map(s => s.toLowerCase());
      result = result.filter(p => (p.sizes || []).some(s => lcSizes.includes((s.size_name || '').toLowerCase())));
    }
    if (selectedShapes.length > 0) {
      const lcShapes = selectedShapes.map(s => s.toLowerCase());
      result = result.filter(p => (p.shapes || []).some(s => lcShapes.includes((s.shape_name || '').toLowerCase())));
    }
    if (selectedCategories.length > 0) {
      const expandedCats = new Set(selectedCategories);
      const addDescendants = (parentId) => {
        const findChildren = (nodes) => { for (const node of nodes) { if (node.id === parentId && node.children) { node.children.forEach(child => { expandedCats.add(child.id); addDescendants(child.id); }); } if (node.children) findChildren(node.children); } };
        findChildren(allCategories);
      };
      selectedCategories.forEach(cid => addDescendants(cid));
      result = result.filter(p => { const pCats = [...(p.category_ids || [])]; if (p.category_id) pCats.push(p.category_id); return pCats.some(c => expandedCats.has(c)); });
    }
    if (sortBy === 'price_asc') result.sort((a, b) => (a.discount_price || a.price) - (b.discount_price || b.price));
    else if (sortBy === 'price_desc') result.sort((a, b) => (b.discount_price || b.price) - (a.discount_price || a.price));
    else if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'discount') result.sort((a, b) => {
      const da = a.discount_price ? Math.round(((a.price - a.discount_price) / a.price) * 100) : 0;
      const db = b.discount_price ? Math.round(((b.price - b.discount_price) / b.price) * 100) : 0;
      return db - da;
    });
    return result;
  }, [products, search, priceRange, discountRange, selectedType, selectedCategories, allCategories, sortBy, selectedColors, selectedSizes, selectedShapes]);

  const handleCategoryToggle = (catId) => { setSelectedCategories(prev => prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]); };
  const clearFilters = () => { setSearch(''); setPriceRange([0, maxPrice]); setDiscountRange([0, 100]); setSelectedType('all'); setSelectedCategories([]); setSortBy('default'); setSelectedColors([]); setSelectedSizes([]); setSelectedShapes([]); };
  const toggleShopColor = (name) => setSelectedColors(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleShopSize = (name) => setSelectedSizes(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleShopShape = (name) => setSelectedShapes(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const clearShopVariants = () => { setSelectedColors([]); setSelectedSizes([]); setSelectedShapes([]); };
  const hasActiveFilters = search || priceRange[0] > 0 || priceRange[1] < maxPrice || discountRange[0] > 0 || discountRange[1] < 100 || selectedType !== 'all' || selectedCategories.length > 0 || sortBy !== 'default' || selectedColors.length > 0 || selectedSizes.length > 0 || selectedShapes.length > 0;
  const isPro = false; // tier system removed — no PRO badge displayed
  const themeConfig = getThemeConfig(shop?.theme || 'classic', shop?.theme_accent);
  const ThemedCard = getThemedCard(shop?.theme || 'classic');

  // Infinite scroll for shop products - must be before early returns
  const ITEMS_PER_PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const shopSentinelRef = useCallback((node) => {
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleCount < filteredProducts.length) {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
      }
    }, { threshold: 0.1, rootMargin: '300px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, filteredProducts.length]);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [search, priceRange, discountRange, selectedType, selectedCategories, sortBy, selectedColors, selectedSizes, selectedShapes]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-slate-950 h-[280px] animate-pulse" />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0">
          {[...Array(8)].map((_, i) => (<div key={i} className="bg-white rounded-xl overflow-hidden border border-slate-100 animate-pulse"><div className="aspect-square bg-slate-200" /><div className="p-3 space-y-2"><div className="h-3 w-16 bg-slate-200 rounded" /><div className="h-4 w-full bg-slate-200 rounded" /></div></div>))}
        </div>
      </div>
    </div>
  );

  if (!shop) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center px-4">
        <Store className="h-16 w-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Shop Not Found</h2>
        <p className="text-slate-500 mb-6">This shop doesn't exist or has been removed.</p>
        <Link to="/" className="inline-flex items-center gap-2 bg-violet-600 text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-violet-700"><ArrowRight className="h-4 w-4 rotate-180" /> Back to Home</Link>
      </div>
    </div>
  );

  // Inline filter JSX to avoid re-render focus loss issues (same pattern as ProductsPage)
  const filterLabelClass = themeConfig.filterTextColor || 'text-slate-400';
  
  const filtersContentJSX = (
    <div className="space-y-5" data-testid="shop-filters">
      <div>
        <Label className={`text-[11px] font-bold tracking-wider uppercase ${filterLabelClass} mb-2.5 block`}>Style</Label>
        <div className={`space-y-1.5 rounded-xl border p-2 ${themeConfig.darkMode ? 'border-zinc-700 bg-zinc-800/40' : 'border-slate-200 bg-white'}`}>
          {[
            { value: 'all', label: 'All', dot: 'bg-violet-500', text: 'text-violet-700', ring: 'peer-checked:ring-violet-300', check: 'peer-checked:bg-violet-600 peer-checked:border-violet-600' },
            { value: 'men', label: 'Men', dot: 'bg-blue-500', text: 'text-blue-700', ring: 'peer-checked:ring-blue-300', check: 'peer-checked:bg-blue-600 peer-checked:border-blue-600' },
            { value: 'women', label: 'Women', dot: 'bg-pink-500', text: 'text-pink-700', ring: 'peer-checked:ring-pink-300', check: 'peer-checked:bg-pink-600 peer-checked:border-pink-600' },
            { value: 'kids', label: 'Kids', dot: 'bg-amber-500', text: 'text-amber-700', ring: 'peer-checked:ring-amber-300', check: 'peer-checked:bg-amber-500 peer-checked:border-amber-500' },
          ].filter(type => type.value === 'all' || products.some(p => p.type === type.value)).map((type) => {
            const checked = selectedType === type.value;
            const baseText = themeConfig.darkMode ? 'text-zinc-200' : 'text-slate-700';
            return (
              <label
                key={type.value}
                className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-all duration-200 ${
                  checked
                    ? (themeConfig.darkMode ? 'bg-zinc-800 border-zinc-600 shadow-sm' : 'bg-slate-50 border-slate-300 shadow-sm')
                    : (themeConfig.darkMode ? 'border-transparent hover:bg-zinc-800/60' : 'border-transparent hover:bg-slate-50 hover:border-slate-200')
                }`}
                data-testid={`shop-type-filter-${type.value}`}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={() => setSelectedType(checked && type.value !== 'all' ? 'all' : type.value)}
                />
                <span className={`relative w-5 h-5 rounded-md border-2 ${themeConfig.darkMode ? 'border-zinc-500' : 'border-slate-300'} flex items-center justify-center transition-all ${type.check} peer-focus-visible:ring-2 ${type.ring}`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
                <span className={`inline-flex items-center gap-2 text-sm font-semibold ${checked ? type.text : baseText}`}>
                  <span className={`w-2 h-2 rounded-full ${type.dot}`} />
                  {type.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <Label className={`text-[11px] font-bold tracking-wider uppercase ${filterLabelClass} mb-2.5 block`}>Categories</Label>
        <CategoryTreeFilter categoryTree={shopCategoryTree} selectedCategories={selectedCategories} onCategoryToggle={handleCategoryToggle} hideProductCounts={true} darkMode={themeConfig.darkMode} />
      </div>
      <div>
        <Label className={`text-[11px] font-bold tracking-wider uppercase ${filterLabelClass} mb-2.5 block`}>Price Range</Label>
        <div className={`rounded-xl p-3 border ${themeConfig.darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-100'}`}>
          <Slider min={0} max={maxPrice} step={10} value={priceRange} onValueChange={setPriceRange} className="mb-2" data-testid="shop-price-range" />
          <div className="flex justify-between text-xs font-semibold"><span className={themeConfig.darkMode ? 'text-zinc-300' : 'text-violet-600'}>${priceRange[0].toLocaleString()}</span><span className={themeConfig.darkMode ? 'text-zinc-300' : 'text-violet-600'}>${priceRange[1] >= maxPrice ? `${maxPrice.toLocaleString()}+` : priceRange[1].toLocaleString()}</span></div>
        </div>
      </div>
      <div>
        <Label className={`text-[11px] font-bold tracking-wider uppercase ${filterLabelClass} mb-2.5 block`}>Discount</Label>
        <div className={`rounded-xl p-3 border ${themeConfig.darkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100'}`}>
          <Slider min={0} max={100} step={5} value={discountRange} onValueChange={setDiscountRange} className="mb-2" data-testid="shop-discount-range" />
          <div className="flex justify-between text-xs font-semibold"><span className={themeConfig.darkMode ? 'text-zinc-300' : 'text-orange-600'}>{discountRange[0]}% off</span><span className={themeConfig.darkMode ? 'text-zinc-300' : 'text-orange-600'}>{discountRange[1]}% off</span></div>
        </div>
      </div>

      {/* Creative Variant Filters */}
      <VariantFilters
        selectedColors={selectedColors}
        selectedSizes={selectedSizes}
        selectedShapes={selectedShapes}
        onColorToggle={toggleShopColor}
        onSizeToggle={toggleShopSize}
        onShapeToggle={toggleShopShape}
        onClearAll={clearShopVariants}
        filterParams={{ shop_id: shopId }}
        darkMode={themeConfig.darkMode}
      />

      {hasActiveFilters && (<Button onClick={clearFilters} variant="outline" className="w-full rounded-xl text-xs h-9 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"><X className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters</Button>)}
    </div>
  );

  const boostedProducts = filteredProducts.filter(p => p.is_shop_boosted);
  const sponsoredInShop = filteredProducts.filter(p => p.is_promoted && !p.is_shop_boosted);
  const regularProducts = filteredProducts.filter(p => !p.is_shop_boosted && !p.is_promoted);
  const otherShopSponsored = sponsoredProducts.filter(p => p.shop_id !== shopId);

  // When a sort is active, maintain the sort order across all products.
  // Only group by sponsored/boosted/regular when using default sort.
  const orderedProducts = sortBy !== 'default'
    ? filteredProducts
    : [...sponsoredInShop, ...boostedProducts, ...regularProducts];
  const visibleAll = orderedProducts.slice(0, visibleCount);
  const hasMoreShopProducts = visibleCount < orderedProducts.length;

  return (
    <div className={`min-h-screen ${themeConfig.bodyBg || 'bg-slate-50'}`} dir={themeConfig.rtl ? 'rtl' : 'ltr'} style={themeConfig.customAccent ? {'--shop-accent': themeConfig.customAccent} : {}}>
      {/* === CREATIVE SHOP HERO — Mobile-First, Responsive === */}
      <div className="relative overflow-hidden" data-testid="shop-hero-header">
        {/* Background: Cover image or themed gradient */}
        {shop.banner ? (
          <div className="absolute inset-0">
            <img src={shop.banner} alt="" className="w-full h-full object-cover scale-105" style={{ filter: 'saturate(1.1)' }} />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/65 to-slate-950/95" />
            <div className="absolute inset-0 bg-gradient-to-r from-violet-900/30 via-transparent to-fuchsia-900/30" />
          </div>
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${themeConfig.heroGradient || 'from-violet-900 via-indigo-900 to-slate-950'}`} />
            <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/20 via-transparent to-cyan-500/20" />
          </>
        )}
        {/* Glow orbs */}
        <div className="absolute -top-32 -left-20 w-80 h-80 bg-violet-500/25 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-[120px] pointer-events-none" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

        <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb (desktop only) */}
          <div className="hidden sm:flex pt-3 pb-1 lg:pt-4 items-center gap-2 text-xs text-white/40">
            <Link to="/" className="hover:text-white/70 transition-colors">Home</Link>
            <span>/</span>
            <Link to="/shops" className="hover:text-white/70 transition-colors">Shops</Link>
            <span>/</span>
            <span className="text-white/60 truncate max-w-[200px]">{shop.name}</span>
          </div>

          {/* MOBILE: Hero compact, badges centered */}
          <div className="sm:hidden pt-4 pb-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <Link to="/shops" className="inline-flex items-center gap-1 text-white/60 text-[11px] font-medium px-2 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                Shops
              </Link>
              <div className="flex items-center gap-1.5">
                {shop.is_verified && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/25 backdrop-blur-md border border-emerald-400/40 text-emerald-200 text-[9px] font-bold rounded-full">
                    <BadgeCheck className="h-3 w-3" /> Verified
                  </div>
                )}
                {isPro && (
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400/30 to-orange-500/30 backdrop-blur-md border border-amber-300/40 text-amber-100 text-[9px] font-bold rounded-full">
                    <Sparkles className="h-3 w-3" /> PRO
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              {/* Logo */}
              <div className="relative mb-3">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl blur-md opacity-60" />
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-white/10 backdrop-blur-md flex items-center justify-center ring-4 ring-white/5">
                  {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" /> : <Store className="h-8 w-8 text-white/70" />}
                </div>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight leading-tight mb-1 max-w-[280px] truncate" data-testid="shop-name">{shop.name}</h1>
              {shop.description && <p className="text-white/55 text-xs leading-relaxed line-clamp-2 mb-3 max-w-[300px]">{shop.description}</p>}

              {/* Stats pills */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-400/25 text-violet-200 text-[10px] font-semibold backdrop-blur-sm">
                  <Package className="h-3 w-3" /> {products.length} items
                </div>
                {products.length > 0 && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200 text-[10px] font-semibold backdrop-blur-sm">
                    <Star className="h-3 w-3 fill-current" /> {(products.reduce((a, p) => a + (p.average_rating || 0), 0) / products.length).toFixed(1)}
                  </div>
                )}
                {shop.state && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/8 border border-white/15 text-white/70 text-[10px] font-semibold backdrop-blur-sm">
                    <MapPin className="h-3 w-3" /> {shop.state}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
                <button
                  onClick={() => { const url = window.location.href; if (navigator.share) { navigator.share({ title: shop.name, url }).catch(() => {}); } else { navigator.clipboard.writeText(url); toast.success('Shop link copied!'); } }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/15 backdrop-blur-md"
                  data-testid="share-shop-btn"
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <Link
                  to={`/shops/map?shop=${shop.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-50 text-xs font-semibold transition-all border border-emerald-300/30 backdrop-blur-md"
                  data-testid="shop-location-btn"
                  title="View this shop on the map"
                >
                  <MapPin className="h-3.5 w-3.5" /> Location
                </Link>
                {gallery.length > 0 && (
                  <button
                    onClick={() => setGalleryModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 hover:from-violet-500/40 hover:to-fuchsia-500/40 text-white text-xs font-semibold transition-all border border-violet-300/30 backdrop-blur-md"
                    data-testid="open-gallery-btn"
                  >
                    <Images className="h-3.5 w-3.5" /> Gallery
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20">{gallery.length}</span>
                  </button>
                )}
                {shop.phone && (
                  <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-xs font-semibold border border-emerald-300/25 backdrop-blur-md transition-all">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </a>
                )}
              </div>

              {/* Sale banner */}
              {activeSale && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/30 to-orange-500/30 border border-rose-300/40 backdrop-blur-md shadow-lg shadow-rose-500/20 animate-pulse" data-testid="hero-sale-banner">
                  <span className="text-rose-100 font-black text-sm">{activeSale.discount_percent}% OFF</span>
                  <span className="text-white/70 text-[10px]">ends {new Date(activeSale.end_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP / TABLET: rich horizontal hero */}
          <div className="hidden sm:block pt-6 pb-10 lg:pt-8 lg:pb-14">
            <div className="flex flex-row gap-6 lg:gap-10 items-start">
              {/* Shop Logo */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity" />
                <div className="relative w-24 h-24 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl bg-white/10 backdrop-blur-md flex items-center justify-center ring-4 ring-white/5">
                  {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" /> : <Store className="h-10 w-10 lg:h-14 lg:w-14 text-white/60" />}
                </div>
              </div>
              {/* Shop Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tight leading-tight" data-testid="shop-name">{shop.name}</h1>
                  {shop.is_verified && (
                    <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-200 rounded-full px-2.5 py-1 text-[10px] font-bold border border-emerald-400/30 backdrop-blur-sm" data-testid="verified-seller-badge">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </div>
                  )}
                  {isPro && (
                    <div className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400/25 to-orange-500/25 text-amber-100 rounded-full px-2.5 py-1 text-[10px] font-bold border border-amber-300/30 backdrop-blur-sm">
                      <Sparkles className="h-3.5 w-3.5" /> PRO
                    </div>
                  )}
                </div>
                {shop.description && <p className="text-white/55 text-sm lg:text-base max-w-2xl mb-4 leading-relaxed line-clamp-2">{shop.description}</p>}

                {/* Stat cards */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-200 text-xs font-semibold backdrop-blur-sm">
                    <Package className="h-3.5 w-3.5" /> {products.length} items
                  </div>
                  {products.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-200 text-xs font-semibold backdrop-blur-sm">
                      <Star className="h-3.5 w-3.5 fill-current" /> {(products.reduce((a, p) => a + (p.average_rating || 0), 0) / products.length).toFixed(1)} rating
                    </div>
                  )}
                  {shop.state && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-xs font-semibold backdrop-blur-sm">
                      <MapPin className="h-3.5 w-3.5" /> {shop.state}
                    </div>
                  )}
                  {shop.phone && (
                    <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 transition-all backdrop-blur-sm">
                      <Phone className="h-3.5 w-3.5" /> {shop.phone}
                    </a>
                  )}
                  {shop.email && (
                    <a href={`mailto:${shop.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-xs font-semibold hover:bg-white/15 transition-all backdrop-blur-sm">
                      <Mail className="h-3.5 w-3.5" /> {shop.email}
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => { const url = window.location.href; if (navigator.share) { navigator.share({ title: shop.name, url }).catch(() => {}); } else { navigator.clipboard.writeText(url); toast.success('Shop link copied!'); } }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/15 backdrop-blur-md" data-testid="share-shop-btn">
                    <Share2 className="h-3.5 w-3.5" /> Share Shop
                  </button>
                  <Link to={`/shops/map?shop=${shop.id}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-50 text-xs font-semibold transition-all border border-emerald-300/30 backdrop-blur-md" data-testid="shop-location-btn" title="View this shop on the map">
                    <MapPin className="h-3.5 w-3.5" /> Location
                  </Link>
                  {gallery.length > 0 && (
                    <button onClick={() => setGalleryModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 hover:from-violet-500/40 hover:to-fuchsia-500/40 text-white text-xs font-semibold transition-all border border-violet-300/30 backdrop-blur-md" data-testid="open-gallery-btn">
                      <Images className="h-3.5 w-3.5" /> Gallery
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20">{gallery.length}</span>
                    </button>
                  )}
                  {activeSale && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500/25 to-orange-500/25 border border-rose-400/40 backdrop-blur-md shadow-lg shadow-rose-500/20" data-testid="hero-sale-banner">
                      <span className="text-rose-100 font-black text-base">{activeSale.discount_percent}% OFF</span>
                      <span className="text-white/70 text-xs">ends {new Date(activeSale.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 h-6">
          <svg viewBox="0 0 1440 24" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0,24 L0,6 Q360,24 720,12 Q1080,0 1440,8 L1440,24 Z" className={themeConfig.waveClass || 'fill-slate-50'} />
          </svg>
        </div>
      </div>

      {/* CONTENT */}
      <div className="w-full px-0 sm:px-4 lg:px-6 py-6">
        <div className="flex items-center justify-between mb-4 px-3 sm:px-0 lg:hidden">
          <h2 className="text-lg font-bold text-slate-900">Products <span className="text-slate-400 font-normal text-sm">({filteredProducts.length})</span></h2>
        </div>
        <div className="flex gap-6">
          <div className="w-56 xl:w-64 flex-shrink-0 hidden lg:block" data-testid="shop-filters-sidebar">
            <div 
              ref={shopFiltersSidebarRef} 
              className="sticky top-[72px]"
              style={{ maxHeight: 'calc(100vh - 86px)' }}
            >
              <div className={`rounded-2xl shadow-sm border overflow-y-auto scrollbar-creative ${themeConfig.filterBg || 'bg-white border-slate-100'} ${themeConfig.darkMode ? 'dark' : ''}`} style={{ maxHeight: 'calc(100vh - 110px)' }}>
                <div className="flex items-center gap-2 p-4 pb-3 border-b border-inherit">
                  <div className={`w-7 h-7 rounded-lg ${themeConfig.filterIconBg || 'bg-gradient-to-br from-violet-500 to-indigo-600'} flex items-center justify-center`}>
                    <SlidersHorizontal className={`h-3.5 w-3.5 ${themeConfig.filterIconColor || 'text-white'}`} />
                  </div>
                  <h2 className={`font-bold text-sm ${themeConfig.filterTitle || 'text-slate-900'}`}>Filters</h2>
                </div>
                <div className="p-4 pt-3">{filtersContentJSX}</div>
              </div>
            </div>
          </div>
          {showMobileFilters && (
            <div className="lg:hidden fixed inset-0 z-50">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)} />
              <div className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-50" onClick={e => e.stopPropagation()} data-testid="mobile-filter-panel">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
                  <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center"><SlidersHorizontal className="h-4 w-4 text-white" /></div><h3 className="font-bold text-sm">Filters</h3></div>
                  <button onClick={() => setShowMobileFilters(false)} className="p-1.5 rounded-full hover:bg-slate-100"><X className="h-5 w-5 text-slate-500" /></button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-creative p-4">{filtersContentJSX}</div>
                <div className="p-4 border-t border-slate-100"><Button className="w-full rounded-full text-xs bg-violet-600 hover:bg-violet-700" onClick={() => setShowMobileFilters(false)}>Apply Filters</Button></div>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {/* "Boosted by this shop" — hero products promoted by this shop */}
            {boostedProducts.length > 0 && (
              <div className="mb-6 px-3 sm:px-0">
                <SponsoredRow
                  surface="shop_public"
                  title="Boosted by this shop"
                  subtitle="Featured picks from this shop"
                  variant="carousel"
                  products={boostedProducts}
                  limit={8}
                  hideShopName={true}
                  data-testid="shop-boosted-row"
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 px-3 sm:px-0 relative z-10" data-testid="shop-search-bar">
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${themeConfig.searchIconColor || 'text-slate-400'}`} />
                <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className={`pl-9 h-10 rounded-xl text-sm ${themeConfig.searchBg || 'bg-white border-slate-200'}`} data-testid="shop-search-input" />
                {search && <button onClick={() => setSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${themeConfig.searchIconColor || 'text-slate-400'} hover:text-slate-600`}><X className="h-4 w-4" /></button>}
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-sm whitespace-nowrap ${themeConfig.countText || 'text-slate-600'}`}><span className={`font-semibold ${themeConfig.countBold || 'text-slate-800'}`}>{filteredProducts.length}</span> products</p>
                <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className={`h-8 text-xs rounded-lg w-44 ${themeConfig.sortBorder || 'border-slate-200'}`} data-testid="shop-sort"><SelectValue placeholder="Default" /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="price_asc">Price: Low to High</SelectItem><SelectItem value="price_desc">Price: High to Low</SelectItem><SelectItem value="name">Name: A-Z</SelectItem><SelectItem value="discount">Biggest Discount</SelectItem></SelectContent></Select>
              </div>
            </div>
            {filteredProducts.length > 0 ? (
              <>
                <div className={`grid ${themeConfig.productGridCols || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'} mobile-products-grid`} data-testid="shop-products-grid">
                  {visibleAll.map((product) => (
                    <ThemedCard key={product.id} product={product} wishlistIds={wishlistIds} />
                  ))}
                </div>
                {/* Infinite scroll sentinel */}
                {hasMoreShopProducts && <div ref={shopSentinelRef} className="h-4 mt-4"><LoadingMoreSpinner /></div>}
                {!hasMoreShopProducts && orderedProducts.length > ITEMS_PER_PAGE && <EndOfListMessage total={orderedProducts.length} />}
              </>
            ) : (
              <div className={`text-center py-16 ${themeConfig.emptyBg || 'bg-white'} rounded-2xl shadow-card`}>
                <Package className={`h-14 w-14 ${themeConfig.darkMode ? 'text-zinc-600' : 'text-slate-200'} mx-auto mb-4`} />
                <h3 className={`text-lg font-bold ${themeConfig.emptyText || 'text-slate-700'} mb-1`}>{products.length === 0 ? 'No products yet' : 'No products found'}</h3>
                <p className={`text-sm ${themeConfig.emptySubtext || 'text-slate-500'} mb-4`}>{products.length === 0 ? "This shop hasn't added products yet." : 'Try adjusting your filters.'}</p>
                {hasActiveFilters && <Button variant="outline" onClick={clearFilters} className="rounded-full text-xs">Clear Filters</Button>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* "Sponsored from other shops" — monetize discovery with cross-shop ads */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-5 lg:px-8 mt-4 mb-10">
        <SponsoredRow
          surface="shop_public"
          title="Sponsored from other shops"
          subtitle="Promoted products from across the marketplace"
          variant="grid"
          excludeShopId={shopId}
          strictShopExclude={true}
          limit={10}
          data-testid="shop-other-sponsored"
        />
      </div>

      {/* Fixed Mobile Filter Button */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40" data-testid="fixed-mobile-filter-btn">
        <Button 
          onClick={() => setShowMobileFilters(true)} 
          className="rounded-full px-6 py-3 shadow-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold flex items-center gap-2"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}
        </Button>
      </div>

      {/* Gallery Modal - Creative Mosaic Layout */}
      {galleryModalOpen && gallery.length > 0 && (
        <div className="fixed inset-0 z-[110]" data-testid="gallery-modal-overlay">
          {/* Fixed backdrop - never scrolls */}
          <div
            className="fixed inset-0 bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-violet-950/95 backdrop-blur-md"
            onClick={() => setGalleryModalOpen(false)}
          />
          {/* Scrollable content layer */}
          <div className="relative h-full w-full overflow-y-auto overscroll-contain">
            <div className="min-h-full flex items-start justify-center p-2 sm:p-4 lg:p-8">
              <div className="relative w-full max-w-6xl my-auto" data-testid="gallery-modal">
                {/* Header - sticky so it stays visible while scrolling */}
                <div className="sticky top-0 z-10 -mx-2 sm:-mx-4 lg:-mx-8 px-4 sm:px-6 lg:px-10 py-3 mb-4 sm:mb-6 backdrop-blur-md bg-slate-950/40 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                      <Images className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-white text-base sm:text-2xl font-bold tracking-tight truncate">{shop?.name} · Gallery</h2>
                      <p className="text-white/50 text-[10px] sm:text-xs">{gallery.length} photo{gallery.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setGalleryModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-md border border-white/10 shrink-0"
                    data-testid="close-gallery-btn"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Creative mosaic - varied sizes for visual interest */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 auto-rows-[120px] sm:auto-rows-[160px] pb-8">
                  {gallery.map((photo, idx) => {
                    // Vary tile sizes for a more creative mosaic
                    const pattern = idx % 7;
                    let colClass = 'col-span-1 row-span-1';
                    if (pattern === 0) colClass = 'col-span-2 row-span-2';
                    else if (pattern === 3) colClass = 'col-span-1 row-span-2';
                    else if (pattern === 5) colClass = 'col-span-2 row-span-1';
                    return (
                      <button
                        key={photo.id}
                        onClick={() => setLightboxIndex(idx)}
                        className={`group relative ${colClass} rounded-2xl overflow-hidden bg-slate-800 ring-1 ring-white/5 hover:ring-violet-400/50 hover:scale-[1.01] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-400`}
                        data-testid={`gallery-tile-${idx}`}
                      >
                        <img src={photo.url} alt={photo.caption || `gallery-${idx}`} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" />
                        {/* Index pill - shown on phone, hover on desktop */}
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white/90 text-[10px] font-bold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {idx + 1}/{gallery.length}
                        </div>
                        {/* Caption */}
                        {photo.caption && (
                          <div className="absolute bottom-0 inset-x-0 p-2 sm:p-3 text-white text-[11px] sm:text-xs font-medium line-clamp-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">{photo.caption}</div>
                        )}
                        {/* Magnify icon - hover only on desktop */}
                        <div className="absolute inset-0 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center">
                            <Eye className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox - Full screen viewer with swipe animation */}
      {lightboxIndex !== null && gallery[lightboxIndex] && (
        <LightboxViewer
          gallery={gallery}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}

      {/* Shop Sale Popup */}
      {showSalePopup && activeSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-testid="shop-sale-popup-overlay">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSalePopup(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300" data-testid="shop-sale-popup">
            {/* Top gradient */}
            <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-3 left-6 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>&#127881;</div>
                <div className="absolute top-6 right-10 text-3xl animate-bounce" style={{ animationDelay: '0.3s' }}>&#11088;</div>
                <div className="absolute bottom-3 left-1/4 text-2xl animate-bounce" style={{ animationDelay: '0.6s' }}>&#128293;</div>
                <div className="absolute bottom-5 right-1/4 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>&#127873;</div>
              </div>
              <button
                onClick={() => setShowSalePopup(false)}
                className="absolute top-3 right-3 text-white/80 hover:text-white bg-white/20 rounded-full p-1.5 transition-colors z-10"
                data-testid="close-shop-sale-popup"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 mb-3 text-sm text-white font-medium">
                  <Tag className="h-3.5 w-3.5" />
                  {shop?.name}
                </div>
                <h2 className="text-4xl font-black text-white mb-2">
                  {activeSale.discount_percent}% OFF
                </h2>
                <p className="text-white/90 font-semibold text-lg">
                  {activeSale.title || 'Store-wide Sale'}
                </p>
              </div>
            </div>

            <div className="p-6 text-center">
              {activeSale.description && (
                <p className="text-slate-700 font-medium mb-4 text-base">{activeSale.description}</p>
              )}
              
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-5 border border-amber-200">
                <div className="flex items-center justify-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <Percent className="h-4 w-4" />
                    <span className="font-bold">{activeSale.discount_percent}% discount on all products</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Ends {new Date(activeSale.end_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  at {new Date(activeSale.end_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <Button
                onClick={() => setShowSalePopup(false)}
                className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 shadow-lg font-bold"
                data-testid="shop-sale-popup-cta"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start Shopping
              </Button>

              <button
                onClick={() => setShowSalePopup(false)}
                className="text-sm text-slate-400 hover:text-slate-600 mt-3 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopPublicPage;
