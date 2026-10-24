import React, { useEffect, useState, useRef, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Store, Star, ChevronRight, ChevronLeft, ShoppingBag, Zap, Heart, TrendingUp, Sparkles, Filter, Percent, Clock, Shield, Truck, X, Loader2, Gift, Tag, Send, Mail, Phone, MessageCircle, HelpCircle, Bug, Lightbulb, AlertTriangle, Handshake, CheckCircle, MapPin, BadgeCheck, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../lib/api';
import ProductCard from '../components/ProductCard';
import ImageUploader from '../components/ImageUploader';
import { useLanguage } from '../lib/i18n';
import SponsoredProductsGrid from '../components/SponsoredProductsGrid';
import PersonalizedRecommendations from '../components/PersonalizedRecommendations';
import HomeBannerCarousel from '../components/HomeBannerCarousel';
import { AuthContext } from '../App';
import { toast } from 'sonner';

const HomePage = () => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [discountProducts, setDiscountProducts] = useState([]);
  const [giftProducts, setGiftProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const [visibleSections, setVisibleSections] = useState({});
  const [typeImages, setTypeImages] = useState({});
  const [saleBadgeEnabled, setSaleBadgeEnabled] = useState(false);
  const [stateShops, setStateShops] = useState([]);
  const [userState, setUserState] = useState('');
  const searchRef = useRef(null);
  
  // Contact form state
  const CONTACT_MESSAGE_TYPES = [
    { value: 'general', label: 'General Inquiry', icon: HelpCircle, color: 'bg-violet-500/10 text-violet-300 border-violet-500/30', activeBg: 'bg-violet-600' },
    { value: 'bug', label: 'Report a Bug', icon: Bug, color: 'bg-red-500/10 text-red-300 border-red-500/30', activeBg: 'bg-red-600' },
    { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'bg-amber-500/10 text-amber-300 border-amber-500/30', activeBg: 'bg-amber-600' },
    { value: 'complaint', label: 'Complaint', icon: AlertTriangle, color: 'bg-orange-500/10 text-orange-300 border-orange-500/30', activeBg: 'bg-orange-600' },
    { value: 'partnership', label: 'Partnership', icon: Handshake, color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', activeBg: 'bg-emerald-600' },
  ];
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.phone_number) { toast.error('Phone number is required'); return; }
    setContactLoading(true);
    try {
      await api.contact.send(contactForm);
      setContactSubmitted(true);
      toast.success('Message sent successfully!');
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally { setContactLoading(false); }
  };
  
  // Infinite scroll state
  const [infiniteProducts, setInfiniteProducts] = useState([]);
  const [infinitePage, setInfinitePage] = useState(1);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [infiniteHasMore, setInfiniteHasMore] = useState(true);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch shops in user's state when logged in
  useEffect(() => {
    const fetchStateShops = async () => {
      if (user) {
        try {
          const meRes = await api.auth.getMe();
          const state = meRes.data?.state;
          if (state) {
            setUserState(state);
            const res = await api.shops.getByState(state);
            setStateShops(res.data || []);
          }
        } catch (e) { /* ignore */ }
      }
    };
    fetchStateShops();
  }, [user]);

  // Intersection observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  // Close search suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, shopsRes, productsRes] = await Promise.all([
        api.categories.getTree(),
        api.shops.getAll(),
        api.products.getAll({ is_active: true }),
      ]);
      const activeCats = catRes.data.filter(c => c.is_active);
      setCategories(activeCats);
      setShops(shopsRes.data.filter(s => 
        s.status === 'approved' && 
        (s.subscription_status === 'active' || s.subscription_status === 'trial')
      ).slice(0, 6));
      const allProducts = productsRes.data;
      setTotalProductCount(allProducts.length);
      setFeaturedProducts(allProducts.slice(0, 8));
      setDiscountProducts(allProducts.filter(p => p.discount_price && p.discount_price < p.price).slice(0, 6));
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      // Render the page as soon as essential data is ready.
      setLoading(false);
    }

    // Secondary, non-essential data fetched in the background (non-blocking).
    api.products.getWithGifts()
      .then(giftRes => setGiftProducts(giftRes.data?.products || []))
      .catch(() => {});
    api.typeImages.get()
      .then(typeRes => setTypeImages(typeRes.data || {}))
      .catch(() => {});
    api.admin.getPlatformSettings()
      .then(settingsRes => setSaleBadgeEnabled(settingsRes.data?.seller_cta_sale_badge_enabled || false))
      .catch(() => {});
  };

  // Infinite scroll: load more products
  const loadMoreProducts = useCallback(async () => {
    if (infiniteLoading || !infiniteHasMore) return;
    setInfiniteLoading(true);
    try {
      const res = await api.products.getAll({ is_active: true, page: infinitePage + 1, limit: 20 });
      const data = res.data;
      // API returns {products, total, page, limit, has_more} when paginated
      const products = data.products || data;
      if (!products || products.length === 0) {
        setInfiniteHasMore(false);
      } else {
        setInfiniteProducts(prev => [...prev, ...products]);
        setInfinitePage(prev => prev + 1);
        if (data.has_more === false) setInfiniteHasMore(false);
      }
    } catch (e) {
      setInfiniteHasMore(false);
    } finally {
      setInfiniteLoading(false);
    }
  }, [infinitePage, infiniteLoading, infiniteHasMore]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && infiniteHasMore && !infiniteLoading) {
          loadMoreProducts();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMoreProducts, infiniteHasMore, infiniteLoading]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) { navigate('/products'); return; }
    navigate(`/products?search=${encodeURIComponent(search)}`);
  };

  const handleSearchInput = (val) => {
    setSearch(val);
    if (val.trim().length > 1) {
      const q = val.toLowerCase();
      const suggestions = [];
      categories.forEach(c => {
        if (c.name.toLowerCase().includes(q)) suggestions.push({ type: 'category', name: c.name, id: c.id });
        c.children?.forEach(sub => {
          if (sub.name.toLowerCase().includes(q)) suggestions.push({ type: 'category', name: `${c.name} > ${sub.name}`, id: sub.id });
        });
      });
      featuredProducts.forEach(p => {
        if (p.name.toLowerCase().includes(q)) suggestions.push({ type: 'product', name: p.name, id: p.id, image: p.images?.[0] });
      });
      shops.forEach(s => {
        if (s.name.toLowerCase().includes(q)) suggestions.push({ type: 'shop', name: s.name, id: s.id });
      });
      setSearchSuggestions(suggestions.slice(0, 6));
    } else {
      setSearchSuggestions([]);
    }
  };

  const handleSuggestionClick = (s) => {
    setSearchFocused(false);
    setSearch('');
    if (s.type === 'product') navigate(`/products/${s.id}`);
    else if (s.type === 'category') navigate(`/products?category=${s.id}`);
    else if (s.type === 'shop') navigate(`/shop/${s.id}`);
  };

  // Category icons/gradients
  const catMeta = {
    'Electronics': { gradient: 'from-cyan-500 to-blue-600', emoji: '' },
    'Fashion': { gradient: 'from-pink-500 to-rose-600', emoji: '' },
    'Home & Living': { gradient: 'from-amber-500 to-orange-600', emoji: '' },
    'default': { gradient: 'from-violet-500 to-purple-600', emoji: '' },
  };
  const getCatMeta = (name) => catMeta[name] || catMeta['default'];

  // Default category images for carousel
  const defaultCategoryImages = {
    'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=400&fit=crop',
    'Fashion': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop',
    'Home & Living': 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&h=400&fit=crop',
    'Footwear': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop',
    'Beauty & Health': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=400&fit=crop',
    'Sports & Outdoors': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop',
    'Books & Stationery': 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=600&h=400&fit=crop',
    'Toys & Games': 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=400&fit=crop',
  };

  const isVisible = (id) => visibleSections[id];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Skeleton Banner */}
        <div className="w-full aspect-[16/10] sm:aspect-[21/8] bg-slate-200 animate-pulse" />
        {/* Skeleton Search Hero (white) */}
        <div className="bg-white pt-8 pb-10 border-b border-slate-100">
          <div className="max-w-3xl mx-auto px-4 text-center space-y-5">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-14 w-full max-w-2xl bg-slate-100 rounded-2xl mt-2" />
              <div className="flex gap-3 mt-2">
                <div className="h-11 w-40 bg-slate-200 rounded-xl" />
                <div className="h-11 w-40 bg-slate-100 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton Categories */}
        <div className="max-w-full mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-24 bg-slate-200 rounded" />
            <div className="h-8 w-56 bg-slate-200 rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-slate-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ========== ADMIN-CONFIGURED SWIPABLE BANNERS ========== */}
      <HomeBannerCarousel />

      {/* ========== ADVANCED SEARCH HERO (white) ========== */}
      <section className="relative bg-white dark:bg-[hsl(220,25%,8%)] overflow-visible border-b border-slate-100 dark:border-white/5" style={{ zIndex: 10 }} data-testid="hero-section">
        {/* Soft decorative gradient accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-28 left-[6%] w-[420px] h-[420px] bg-violet-300/25 dark:bg-violet-600/15 rounded-full blur-[120px]" />
          <div className="absolute -bottom-28 right-[5%] w-[380px] h-[380px] bg-indigo-300/25 dark:bg-indigo-600/15 rounded-full blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `linear-gradient(rgba(139,92,246,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.4) 1px, transparent 1px)`,
            backgroundSize: '56px 56px'
          }} />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-9 sm:pt-10 sm:pb-12">
          {/* ===== ADVANCED SEARCH BAR ===== */}
          <div className="max-w-2xl mx-auto animate-hero-up2 relative z-50" ref={searchRef}>
            <form onSubmit={handleSearch} className="relative" data-testid="advanced-search-form">
              <div className="relative">
                <div className={`relative flex items-center bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 ${searchFocused ? 'border-violet-400 shadow-[0_8px_30px_rgba(139,92,246,0.18)]' : 'border-slate-200 dark:border-white/10 shadow-sm'}`}>
                  <div className="ml-4 flex items-center">
                    <Search className={`h-5 w-5 transition-colors ${searchFocused ? 'text-violet-500' : 'text-slate-400'}`} />
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    placeholder={t('home.hero.searchPlaceholder')}
                    className="flex-1 bg-transparent text-slate-800 dark:text-white placeholder:text-slate-400 border-0 py-3.5 px-3 text-sm sm:text-base outline-none"
                    data-testid="hero-search-input"
                  />
                  {search && (
                    <button type="button" onClick={() => { setSearch(''); setSearchSuggestions([]); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="m-1.5 px-5 sm:px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/30 flex items-center gap-1.5"
                    data-testid="hero-search-button"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('products.search') || 'Search'}</span>
                  </button>
                </div>

                {/* Search suggestions dropdown */}
                {searchFocused && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[200]" data-testid="search-suggestions">
                    {searchSuggestions.map((s, i) => (
                      <button key={i} onClick={() => handleSuggestionClick(s)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 dark:hover:bg-white/5 transition-colors text-left">
                        {s.type === 'product' && s.image ? (
                          <img src={s.image} alt="" className="w-8 h-8 rounded-lg object-cover" loading="lazy" />
                        ) : (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${s.type === 'category' ? 'bg-violet-100 text-violet-600' : s.type === 'shop' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            {s.type === 'category' ? <Filter className="h-3.5 w-3.5" /> : s.type === 'shop' ? <Store className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-white truncate">{s.name}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{s.type}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick filters */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {['Electronics', 'Fashion', 'Home & Living'].map(cat => {
                  const c = categories.find(ct => ct.name === cat);
                  return c ? (
                    <Link key={c.id} to={`/products?category=${c.id}`} className="text-xs text-slate-600 dark:text-slate-300 hover:text-violet-600 bg-slate-100 dark:bg-white/5 hover:bg-violet-50 border border-slate-200 dark:border-white/10 rounded-full px-3 py-1 transition-all">{cat}</Link>
                  ) : null;
                })}
                <Link to="/products" className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors">{t('products.browseAll') || 'Browse All'}</Link>
              </div>
            </form>
          </div>

          {/* ===== CTA BUTTONS ===== */}
          <div className="relative z-0 flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 animate-hero-up3">
            <Link
              to="/products"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-300"
              data-testid="hero-start-shopping-btn"
            >
              <ShoppingBag className="h-4 w-4" />
              {t('home.hero.startShopping')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/become-seller"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 hover:border-violet-400 text-slate-800 dark:text-white hover:text-violet-700 dark:hover:text-violet-300 text-sm font-semibold transition-all duration-300"
              data-testid="hero-become-seller-btn"
            >
              <Store className="h-4 w-4" />
              {t('home.hero.startSelling')}
              {saleBadgeEnabled && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">SALE</span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* ========== CATEGORIES - Swipeable Carousel with Photos ========== */}
      <section id="categories-section" data-animate className="py-6 sm:py-8 bg-slate-50" data-testid="categories-section">
        <div className="max-w-full mx-auto px-3 sm:px-5 lg:px-6">
          <div className={`flex items-end justify-between mb-4 transition-all duration-700 ${isVisible('categories-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-violet-600 mb-0.5 block">Explore</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{t('home.shopByCategory')}</h2>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <button 
                onClick={() => { const el = document.getElementById('cat-carousel'); if(el) el.scrollBy({left: -320, behavior:'smooth'}); }}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 flex items-center justify-center text-slate-600 hover:text-violet-600 transition-all shadow-sm"
                data-testid="cat-scroll-left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={() => { const el = document.getElementById('cat-carousel'); if(el) el.scrollBy({left: 320, behavior:'smooth'}); }}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 flex items-center justify-center text-slate-600 hover:text-violet-600 transition-all shadow-sm"
                data-testid="cat-scroll-right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Swipeable Carousel */}
          <div 
            id="cat-carousel"
            className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-3 px-3"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categories.map((cat, i) => {
              const meta = getCatMeta(cat.name);
              const subcats = cat.children?.filter(c => c.is_active) || [];
              const catImage = cat.image || defaultCategoryImages[cat.name];
              return (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.id}`}
                  className="group relative flex-shrink-0 w-[220px] sm:w-[260px] snap-start rounded-xl overflow-hidden transition-all duration-500 hover:shadow-xl hover:-translate-y-0.5"
                  data-testid={`category-card-${cat.id}`}
                >
                  <div className="relative h-[160px] sm:h-[180px]">
                    {catImage ? (
                      <img src={catImage} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3.5">
                      <h3 className="text-white font-bold text-sm sm:text-base tracking-tight mb-0.5">{cat.name}</h3>
                      {subcats.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {subcats.slice(0, 2).map(sub => (
                            <span key={sub.id} className="text-[9px] sm:text-[10px] bg-white/20 text-white/90 rounded-full px-1.5 py-px backdrop-blur-sm">{sub.name}</span>
                          ))}
                          {subcats.length > 2 && <span className="text-[9px] text-white/50">+{subcats.length - 2}</span>}
                        </div>
                      )}
                    </div>
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/0 group-hover:bg-white/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                      <ArrowRight className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </Link>
              );
            })}
            <Link to="/products" className="group relative flex-shrink-0 w-[160px] sm:w-[180px] snap-start rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center h-[160px] sm:h-[180px] transition-all duration-500 hover:shadow-xl" data-testid="category-card-all">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(45deg, transparent 40%, rgba(139,92,246,0.3) 50%, transparent 60%)`, backgroundSize: '200% 200%', animation: 'shimmer 3s infinite linear' }} />
              <div className="relative text-center p-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="h-4 w-4 text-violet-400" />
                </div>
                <p className="text-white font-bold text-xs sm:text-sm">Browse All</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{categories.length} categories</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Shop by Type section moved below Sponsored */}

      {/* ========== DEALS MARQUEE STRIP ========== */}
      {discountProducts.length > 0 && (
        <section className="py-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 overflow-hidden" data-testid="deals-strip">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...discountProducts, ...discountProducts, ...discountProducts].map((p, i) => {
              const pct = Math.round(((p.price - p.discount_price) / p.price) * 100);
              return (
                <span key={i} className="inline-flex items-center gap-1 sm:gap-1.5 mx-3 sm:mx-6 text-[9px] sm:text-[11px] text-white/90 font-medium">
                  <Percent className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-yellow-300" />
                  <span className="max-w-[120px] sm:max-w-none truncate">{p.name}</span> — <span className="text-yellow-300 font-bold">{pct}% OFF</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* ========== FEATURED SHOPS - Filtered by user's state when logged in ========== */}
      <section id="shops-section" data-animate className="py-8 sm:py-10 bg-white" data-testid="featured-shops-section">
        <div className="max-w-full mx-auto px-3 sm:px-5 lg:px-6">
          <div className={`flex items-end justify-between mb-6 transition-all duration-700 ${isVisible('shops-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div>
              {user && userState ? (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-full mb-2">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 dark:text-emerald-400">Near You</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Trusted Shops in {userState}</h2>
                  <p className="text-xs text-slate-400 mt-1">Shops available in your area</p>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-600 mb-1 block">Curated Selection</span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{t('home.trustedShops')}</h2>
                  <p className="text-xs text-slate-400 mt-1">Handpicked sellers with exceptional quality</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { const el = document.getElementById('shops-carousel'); if(el) el.scrollBy({left: -320, behavior:'smooth'}); }} className="hidden sm:flex w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 items-center justify-center text-slate-600 hover:text-emerald-600 transition-all shadow-sm"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <button onClick={() => { const el = document.getElementById('shops-carousel'); if(el) el.scrollBy({left: 320, behavior:'smooth'}); }} className="hidden sm:flex w-8 h-8 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 items-center justify-center text-slate-600 hover:text-emerald-600 transition-all shadow-sm"><ChevronRight className="h-3.5 w-3.5" /></button>
              <Link to="/shops" className="hidden sm:flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-semibold group ml-2">
                {t('home.viewAll')} <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {(() => {
            const displayShops = user && userState ? stateShops : shops;
            return displayShops.length > 0 ? (
            <div id="shops-carousel" className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide -mx-3 px-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {displayShops.map((shop, index) => (
                <Link
                  key={shop.id}
                  to={`/shop/${shop.id}`}
                  className={`group relative flex-shrink-0 w-[260px] sm:w-[320px] snap-start rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-[0_18px_50px_-20px_rgba(15,23,42,0.25)] hover:-translate-y-1.5 transition-all duration-500 ease-out ${
                    isVisible('shops-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${150 + index * 80}ms` }}
                  data-testid={`trusted-shop-card-${shop.id}`}
                >
                  {/* Cover photo with overlay */}
                  <div className="relative h-32 sm:h-36 overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600">
                    {shop.banner ? (
                      <img
                        src={shop.banner}
                        alt={`${shop.name} cover`}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1200ms] ease-out"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${
                        index % 5 === 0 ? 'from-violet-500 via-purple-500 to-fuchsia-500' :
                        index % 5 === 1 ? 'from-emerald-500 via-teal-500 to-cyan-500' :
                        index % 5 === 2 ? 'from-rose-500 via-pink-500 to-fuchsia-500' :
                        index % 5 === 3 ? 'from-amber-500 via-orange-500 to-red-500' :
                        'from-blue-500 via-indigo-500 to-violet-500'
                      }`}>
                        {/* Decorative pattern when no banner */}
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '18px 18px' }} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/30 to-transparent" />

                    {/* State pill */}
                    {shop.state && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/15 backdrop-blur-md text-white border border-white/25 tracking-wide">
                        <MapPin className="h-2.5 w-2.5" /> {shop.state}
                      </span>
                    )}

                    {/* Animated accent bar at bottom of cover */}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />

                    {/* Sale badge on cover */}
                    {shop.has_active_sale && shop.active_sale_percent && (
                      <div className="absolute top-2 right-2 z-10" data-testid={`shop-sale-badge-${shop.id}`}>
                        <div className="relative">
                          <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 lg:px-3 lg:py-1.5 shadow-lg shadow-orange-500/40 border border-white/20 inline-flex items-center gap-1 sm:gap-1.5">
                            <span className="text-[9px] sm:text-[10px] lg:text-[11px] font-bold uppercase tracking-wider opacity-90 leading-none">Sale</span>
                            <span className="text-xs sm:text-sm lg:text-base font-black leading-none">-{shop.active_sale_percent}%</span>
                          </div>
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-300 rounded-full animate-ping opacity-60" />
                          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Overlapping avatar + content */}
                  <div className="relative px-4 pb-4 pt-3">
                    <div className="flex items-start gap-3 -mt-10">
                      <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-white border-[3px] border-white shadow-lg overflow-hidden flex items-center justify-center">
                          {shop.logo ? (
                            <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xl font-black">
                              {shop.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-white shadow">
                          <BadgeCheck className="h-3 w-3 text-white" strokeWidth={3} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pt-9">
                        <h3 className="font-extrabold text-base text-slate-900 truncate tracking-tight group-hover:text-emerald-700 transition-colors">{shop.name}</h3>
                      </div>
                    </div>

                    <p className="text-[11.5px] text-slate-500 line-clamp-2 mt-3 mb-3 leading-relaxed min-h-[34px]">{shop.description || 'Quality products & fast delivery across Lebanon.'}</p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 border border-emerald-100">
                        <Shield className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Trusted</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 group-hover:text-emerald-600 transition-colors">
                        Visit Shop
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 rounded-2xl">
              <Store className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 mb-1">{user && userState ? `No Shops in ${userState} Yet` : 'No Shops Yet'}</h3>
              <p className="text-slate-500 text-xs mb-4">{user && userState ? 'Check out shops from other regions' : 'Be the first to open your shop!'}</p>
              <Link to={user && userState ? "/shops" : "/become-seller"} className="inline-flex items-center gap-1.5 bg-violet-600 text-white rounded-full px-5 py-2 text-xs font-medium hover:bg-violet-700 transition-colors">
                <Store className="h-3.5 w-3.5" /> {user && userState ? 'Browse All Shops' : 'Open Your Shop'}
              </Link>
            </div>
          );
          })()}
        </div>
      </section>

      {/* ========== SPONSORED PRODUCTS (full-width grid) ========== */}
      <section className="py-6 sm:py-8 bg-gradient-to-r from-amber-50/50 to-orange-50/50" data-testid="sponsored-section">
        <div className="w-full px-0 sm:px-5 lg:px-6">
          <SponsoredProductsGrid />
        </div>
      </section>

      {/* ========== FREE GIFT PRODUCTS SECTION - Full Width Grid ========== */}
      {giftProducts.length > 0 && (
        <section className="py-8 sm:py-10 bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" data-testid="gift-products-section">
          <div className="w-full px-0 sm:px-5 lg:px-6">
            <div className="text-center mb-6 px-3 sm:px-0">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full mb-3">
                <Gift className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">Free Gift Included</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Products With Free Gifts</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">Buy any of these products and receive a free gift automatically with your order — no code needed!</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0 sm:gap-3 mobile-products-grid overflow-hidden">
              {giftProducts.slice(0, 12).map(product => (
                <ProductCard key={product.id} product={product} showShopName={true} />
              ))}
            </div>
            {giftProducts.length > 12 && (
              <div className="text-center mt-5">
                <Link to="/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pink-600 hover:text-pink-700 group">
                  View All Gift Products <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========== SHOP BY TYPE (Men/Women/Kids) - Creative Modern Section ========== */}
      <section id="type-section" data-animate className="py-10 sm:py-16 bg-white relative overflow-hidden" data-testid="type-section">
        {/* Subtle decorative background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[-100px] right-[-50px] w-[350px] h-[350px] bg-pink-100/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-80px] left-[-30px] w-[280px] h-[280px] bg-blue-100/30 rounded-full blur-[100px]" />
          <div className="absolute top-[30%] left-[50%] w-[200px] h-[200px] bg-amber-100/20 rounded-full blur-[80px]" />
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className={`text-center mb-8 sm:mb-12 transition-all duration-700 ${isVisible('type-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-100/80 to-pink-100/80 backdrop-blur-sm rounded-full px-5 py-2 mb-4 border border-violet-200/40">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-bold tracking-wider uppercase text-violet-700">Curated For You</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Choose Your <span className="bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 bg-clip-text text-transparent">Style</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-3 max-w-lg mx-auto">Browse handpicked collections tailored to your taste</p>
          </div>

          {/* Style Cards - Refined aspect ratio + better fashion photos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 max-w-md sm:max-w-4xl lg:max-w-5xl mx-auto">
            {[
              { 
                key: 'men', 
                label: "Men's", 
                tagline: 'Sharp & Refined',
                defaultImage: 'https://images.unsplash.com/photo-1617196701537-7329482cc9fe?w=800&h=1000&fit=crop',
                gradient: 'from-slate-900 via-blue-900 to-indigo-900', 
                accent: 'bg-blue-500',
                accentText: 'text-blue-400',
                iconBg: 'from-blue-500/20 to-indigo-500/20',
                iconBorder: 'border-blue-400/30',
              },
              { 
                key: 'women', 
                label: "Women's", 
                tagline: 'Elegant & Bold',
                defaultImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=1000&fit=crop',
                gradient: 'from-rose-600 via-pink-600 to-fuchsia-600', 
                accent: 'bg-pink-400',
                accentText: 'text-pink-300',
                iconBg: 'from-pink-400/20 to-rose-400/20',
                iconBorder: 'border-pink-300/30',
              },
              { 
                key: 'kids', 
                label: 'Kids', 
                tagline: 'Fun & Playful',
                defaultImage: 'https://images.unsplash.com/photo-1622290319146-7b72e4e1ad81?w=800&h=1000&fit=crop',
                gradient: 'from-amber-500 via-orange-500 to-yellow-500', 
                accent: 'bg-amber-300',
                accentText: 'text-amber-200',
                iconBg: 'from-amber-300/20 to-yellow-300/20',
                iconBorder: 'border-amber-300/30',
              },
            ].map((type, index) => (
              <Link 
                key={type.key} 
                to={`/products?type=${type.key}`} 
                className="style-card group relative rounded-2xl sm:rounded-3xl overflow-hidden ring-2 ring-transparent block"
                data-testid={`choose-style-card-${type.key}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className={`relative bg-gradient-to-br ${type.gradient} overflow-hidden aspect-[4/5] sm:aspect-[3/4]`}>
                  {/* Background image */}
                  <img 
                    src={typeImages[type.key] || type.defaultImage} 
                    alt={type.label} 
                    className="style-card-img absolute inset-0 w-full h-full object-cover" 
                    loading="lazy" 
                  />
                  
                  {/* Base gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  {/* Desktop hover overlay - intensifies on hover */}
                  <div className="style-card-overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0" />
                  
                  {/* Glass effect top accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 sm:h-1.5">
                    <div className={`h-full ${type.accent} opacity-80`} />
                  </div>
                  
                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-5 lg:p-6">
                    {/* Icon circle - smaller on mobile */}
                    <div className={`style-card-icon w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br ${type.iconBg} backdrop-blur-md border ${type.iconBorder} flex items-center justify-center mb-2 sm:mb-3`}>
                      {type.key === 'men' && <svg className="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
                      {type.key === 'women' && <svg className="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a7 7 0 0 1 7 7c0 3.87-3.13 7-7 7s-7-3.13-7-7a7 7 0 0 1 7-7z"/><path d="M12 16v6"/><path d="M9 19h6"/></svg>}
                      {type.key === 'kids' && <svg className="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1.5" fill="currentColor"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/></svg>}
                    </div>
                    
                    {/* Text - smaller on mobile */}
                    <div>
                      <p className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.15em] ${type.accentText} mb-0.5`}>{type.tagline}</p>
                      <h3 className="text-white font-extrabold text-base sm:text-2xl lg:text-3xl tracking-tight leading-none">{type.label}</h3>
                    </div>
                    
                    {/* CTA button - smaller on mobile */}
                    <div className="mt-2 sm:mt-4">
                      <div className="style-card-cta inline-flex items-center gap-1.5 sm:gap-2 text-white text-[10px] sm:text-xs font-semibold bg-white/10 backdrop-blur-md rounded-full px-3 sm:px-5 py-1.5 sm:py-2.5 border border-white/10">
                        Explore <ArrowRight className="style-card-cta-arrow h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Shine effect - desktop-only via .style-card-shine */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden hidden sm:block">
                    <div className="style-card-shine absolute top-0 w-[60%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ========== AI PERSONALIZED RECOMMENDATIONS (Primary) ========== */}
      <section className="py-6 sm:py-8 bg-white" data-testid="recommendations-section">
        <div className="max-w-full mx-auto px-3 sm:px-5 lg:px-6">
          <PersonalizedRecommendations />
        </div>
      </section>

      {/* ========== ALL SHOPS - Shown only for logged-in users (right after Recommended) ========== */}
      {user && shops.length > 0 && (
        <section id="all-shops-section" data-animate className="py-8 sm:py-10 bg-slate-50" data-testid="all-shops-section">
          <div className="max-w-full mx-auto px-3 sm:px-5 lg:px-6">
            <div className={`flex items-end justify-between mb-6 transition-all duration-700 ${isVisible('all-shops-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-violet-600 mb-1 block">All Sellers</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Browse All Shops</h2>
                <p className="text-xs text-slate-400 mt-1">Explore all trusted sellers across Lebanon</p>
              </div>
              <Link to="/shops" className="hidden sm:flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-semibold group">
                View All <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="all-shops-grid">
              {shops.map((shop, idx) => (
                <Link
                  key={shop.id}
                  to={`/shop/${shop.id}`}
                  className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
                  data-testid={`all-shop-card-${shop.id}`}
                >
                  <div className="relative h-28 overflow-hidden">
                    {shop.banner ? (
                      <img src={shop.banner} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <div className={`absolute inset-0 bg-gradient-to-br ${
                        idx % 5 === 0 ? 'from-violet-500 via-purple-500 to-fuchsia-500' :
                        idx % 5 === 1 ? 'from-blue-500 via-indigo-500 to-violet-500' :
                        idx % 5 === 2 ? 'from-emerald-500 via-teal-500 to-cyan-500' :
                        idx % 5 === 3 ? 'from-amber-500 via-orange-500 to-rose-500' :
                        'from-pink-500 via-rose-500 to-red-500'
                      }`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 flex items-end gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                        {shop.logo ? <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" /> : <Store className="h-6 w-6 text-white" />}
                      </div>
                      <div className="pb-0.5">
                        <h3 className="font-bold text-white text-sm drop-shadow-lg leading-tight">{shop.name}</h3>
                        {shop.state && <p className="text-white/70 text-[10px] flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {shop.state}</p>}
                      </div>
                    </div>
                    {/* Sale badge on cover */}
                    {shop.has_active_sale && shop.active_sale_percent && (
                      <div className="absolute top-1.5 right-1.5 z-10" data-testid={`shop-sale-cover-${shop.id}`}>
                        <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1 lg:px-2.5 lg:py-1.5 shadow-lg shadow-orange-500/40 border border-white/20 inline-flex items-center gap-0.5 sm:gap-1">
                          <span className="text-[8px] sm:text-[9px] lg:text-[10px] font-bold uppercase tracking-wider opacity-90 leading-none">Sale</span>
                          <span className="text-[10px] sm:text-xs lg:text-sm font-black leading-none">-{shop.active_sale_percent}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    {shop.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{shop.description}</p>}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-100">
                        <Shield className="h-2.5 w-2.5" />
                        <span className="text-[8px] font-bold uppercase tracking-wider">Trusted</span>
                      </div>
                      <span className="text-[10px] text-violet-600 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Visit <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="sm:hidden text-center mt-4">
              <Link to="/shops" className="inline-flex items-center gap-1 text-xs text-violet-600 font-semibold">
                View All Shops <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ========== TRENDING PRODUCTS - Full Width Grid ========== */}
      {featuredProducts.length > 0 && (
        <section id="trending-section" data-animate className="py-6 sm:py-8 bg-slate-50" data-testid="trending-section">
          <div className="w-full px-0 sm:px-5 lg:px-6">
            <div className={`flex items-end justify-between mb-4 px-3 sm:px-0 transition-all duration-700 ${isVisible('trending-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-rose-600 mb-0.5 block">Popular</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Trending Now</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { const el = document.getElementById('trending-carousel'); if(el) el.scrollBy({left: -320, behavior:'smooth'}); }} className="sm:hidden w-9 h-9 rounded-full bg-white border-2 border-rose-200 hover:border-rose-400 flex items-center justify-center text-rose-500 hover:text-rose-600 transition-all shadow-md active:scale-90" data-testid="trending-scroll-left-mobile"><ChevronLeft className="h-5 w-5 stroke-[3]" /></button>
                <button onClick={() => { const el = document.getElementById('trending-carousel'); if(el) el.scrollBy({left: 320, behavior:'smooth'}); }} className="sm:hidden w-9 h-9 rounded-full bg-white border-2 border-rose-200 hover:border-rose-400 flex items-center justify-center text-rose-500 hover:text-rose-600 transition-all shadow-md active:scale-90" data-testid="trending-scroll-right-mobile"><ChevronRight className="h-5 w-5 stroke-[3]" /></button>
                <Link to="/products" className="hidden sm:flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-semibold group ml-2">
                  View All <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Mobile: swipeable row | Desktop: grid */}
            <div id="trending-carousel" className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide px-3 sm:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {featuredProducts.slice(0, 8).map((product) => (
                <div key={product.id} className="flex-shrink-0 w-[160px] snap-start">
                  <ProductCard product={product} hideVariantCounts={true} />
                </div>
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {featuredProducts.slice(0, 12).map((product) => (
                <ProductCard key={product.id} product={product} hideVariantCounts={true} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== HOT DEALS - with mobile swipe buttons ========== */}
      {discountProducts.length > 0 && (
        <section id="deals-section" data-animate className="py-6 sm:py-8 bg-white" data-testid="deals-section">
          <div className="w-full px-0 sm:px-5 lg:px-6">
            <div className={`flex items-end justify-between mb-4 px-3 sm:px-0 transition-all duration-700 ${isVisible('deals-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-600 mb-0.5 block">Limited Time</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{t('home.hotDeals')}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { const el = document.getElementById('deals-carousel'); if(el) el.scrollBy({left: -320, behavior:'smooth'}); }} className="sm:hidden w-9 h-9 rounded-full bg-white border-2 border-orange-200 hover:border-orange-400 flex items-center justify-center text-orange-500 hover:text-orange-600 transition-all shadow-md active:scale-90" data-testid="deals-scroll-left-mobile"><ChevronLeft className="h-5 w-5 stroke-[3]" /></button>
                <button onClick={() => { const el = document.getElementById('deals-carousel'); if(el) el.scrollBy({left: 320, behavior:'smooth'}); }} className="sm:hidden w-9 h-9 rounded-full bg-white border-2 border-orange-200 hover:border-orange-400 flex items-center justify-center text-orange-500 hover:text-orange-600 transition-all shadow-md active:scale-90" data-testid="deals-scroll-right-mobile"><ChevronRight className="h-5 w-5 stroke-[3]" /></button>
                <Link to="/products" className="hidden sm:flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-semibold group ml-2">
                  Shop Deals <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Mobile: swipeable row | Desktop: grid */}
            <div id="deals-carousel" className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide px-3 sm:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {discountProducts.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-[160px] snap-start">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
            <div className="hidden sm:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {discountProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== PERKS BAR ========== */}
      <section id="perks-section" data-animate className="py-6 bg-slate-50 border-t border-slate-100" data-testid="perks-section">
        <div className="max-w-full mx-auto px-3 sm:px-5 lg:px-6">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 transition-all duration-700 ${isVisible('perks-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {[
              { icon: Truck, title: t('home.fastDelivery'), desc: t('home.acrossAllRegions'), color: 'text-blue-600 bg-blue-50' },
              { icon: Shield, title: t('home.secureShop'), desc: t('home.protectedPayments'), color: 'text-emerald-600 bg-emerald-50' },
              { icon: Percent, title: t('home.bestPrices'), desc: t('home.guaranteedSavings'), color: 'text-orange-600 bg-orange-50' },
              { icon: Clock, title: t('home.support247'), desc: t('home.alwaysHere'), color: 'text-violet-600 bg-violet-50' },
            ].map((perk, i) => (
              <div key={i} className="flex items-center gap-2.5 group" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${perk.color} group-hover:scale-110 transition-transform`}>
                  <perk.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-bold text-xs text-slate-900">{perk.title}</p>
                  <p className="text-[10px] text-slate-500">{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== INFINITE SCROLL PRODUCTS ========== */}
      {infiniteProducts.length > 0 && (
        <section className="py-6 sm:py-8 bg-slate-50" data-testid="infinite-products-section">
          <div className="w-full px-0 sm:px-5 lg:px-6">
            <div className="px-3 sm:px-0 mb-4">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-0.5 block">More To Explore</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">All Products</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0 sm:gap-3 mobile-products-grid overflow-hidden">
              {infiniteProducts.map((product) => (
                <ProductCard key={`inf-${product.id}`} product={product} showShopName={true} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="flex justify-center">
        {infiniteLoading && (
          <div className="flex items-center gap-2 text-slate-500 py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading more products...</span>
          </div>
        )}
      </div>

      {/* ========== CTA / BECOME SELLER + CONTACT (dark seamless block) ========== */}
      <div className="bg-slate-950">
      <section id="cta-section" data-animate className="relative py-14 sm:py-20 overflow-hidden" data-testid="cta-section">
        <div className="absolute inset-0 bg-slate-950" />
        {/* Grid dots */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, rgba(139,92,246,0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        <div className="absolute top-0 left-[20%] w-[400px] h-[400px] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-[20%] w-[300px] h-[300px] bg-indigo-600/15 rounded-full blur-[100px]" />

        <div className={`relative max-w-3xl mx-auto px-4 text-center transition-all duration-700 ${isVisible('cta-section') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1 mb-4">
            <Zap className="h-3 w-3 text-yellow-400" />
            <span className="text-[10px] font-medium text-white/80">Join the marketplace</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
            Ready to grow{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">your business</span>?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mb-6 max-w-xl mx-auto">
            Set up your shop in minutes. Reach thousands of customers. Start selling today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-8 font-bold shadow-xl shadow-white/5 h-12">
              <Link to="/become-seller" data-testid="cta-become-seller">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Become a Seller
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 h-12">
              <Link to="/products" data-testid="cta-browse">
                Browse Products
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ========== CREATIVE CONTACT FORM SECTION ========== */}
      <section className="relative overflow-hidden bg-slate-950" data-testid="home-contact-section">
        {/* Seamless connection - gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          <div className="absolute top-[-200px] right-[10%] w-[500px] h-[500px] bg-emerald-600/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-100px] left-[15%] w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.3) 35px, rgba(255,255,255,0.3) 36px)' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left side - Creative text & info */}
            <div className="lg:sticky lg:top-24">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold mb-6 backdrop-blur-sm">
                <MessageCircle className="h-3.5 w-3.5" />
                We'd love to hear from you
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight leading-[1.1]">
                Get in{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">Touch</span>
                  <svg className="absolute -bottom-1 left-0 w-full h-2" viewBox="0 0 100 8" preserveAspectRatio="none">
                    <path d="M0 7 Q25 0, 50 4 T100 3" fill="none" stroke="url(#ctGrad)" strokeWidth="2" strokeLinecap="round" />
                    <defs><linearGradient id="ctGrad" x1="0" x2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient></defs>
                  </svg>
                </span>
              </h2>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                Have a question, idea, or just want to say hello? Drop us a message and we'll get back to you within 24 hours.
              </p>

              {/* Contact info pills */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mail className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email</p>
                    <p className="text-sm text-white/80 font-medium" data-testid="home-contact-email">contact@openmarketlb.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Phone className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Phone</p>
                    <p className="text-sm text-white/80 font-medium" data-testid="home-contact-phone">12-345-6789</p>
                  </div>
                </div>
              </div>

              {/* Decorative floating elements */}
              <div className="hidden lg:block mt-12 relative h-28">
                <div className="absolute left-0 top-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-white/5 flex items-center justify-center" style={{ animation: 'float 6s ease-in-out infinite' }}>
                  <Send className="h-6 w-6 text-violet-400/50" />
                </div>
                <div className="absolute left-24 top-4 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-white/5 flex items-center justify-center" style={{ animation: 'float 5s ease-in-out infinite 1s' }}>
                  <Heart className="h-5 w-5 text-emerald-400/50" />
                </div>
                <div className="absolute left-10 top-16 w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-white/5 flex items-center justify-center" style={{ animation: 'float 7s ease-in-out infinite 0.5s' }}>
                  <Star className="h-4 w-4 text-amber-400/50" />
                </div>
              </div>
            </div>

            {/* Right side - Form */}
            <div>
              {contactSubmitted ? (
                <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 text-center">
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                    <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-10 w-10 text-emerald-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                  <p className="text-slate-400 text-sm mb-6">Thanks for reaching out. We'll get back to you within 24 hours.</p>
                  <Button onClick={() => { setContactSubmitted(false); setContactForm({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' }); }} variant="outline" className="rounded-full border-white/20 text-white hover:bg-white/10" data-testid="contact-send-another">
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden" data-testid="home-contact-form">
                  {/* Form header */}
                  <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <MessageCircle className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Send us a Message</h3>
                    </div>
                    <p className="text-xs text-slate-500 ml-[52px]">Fill in the form and we'll respond as soon as possible</p>
                  </div>

                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-5">
                    {/* Message type pills */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 block">What's this about?</Label>
                      <div className="flex flex-wrap gap-2">
                        {CONTACT_MESSAGE_TYPES.map((type) => {
                          const Icon = type.icon;
                          const isSelected = contactForm.message_type === type.value;
                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setContactForm({ ...contactForm, message_type: type.value })}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all ${
                                isSelected ? `${type.activeBg} text-white border-transparent shadow-lg scale-105` : `${type.color} hover:scale-105`
                              }`}
                              data-testid={`home-msg-type-${type.value}`}
                            >
                              <Icon className="h-3 w-3" />
                              {type.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Name + Email row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Name *</Label>
                        <Input name="name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} required placeholder="John Doe" className="mt-1.5 h-11 rounded-xl bg-white/[0.05] border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:bg-white/[0.08]" data-testid="home-contact-name" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Email *</Label>
                        <Input name="email" type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} required placeholder="john@example.com" className="mt-1.5 h-11 rounded-xl bg-white/[0.05] border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:bg-white/[0.08]" data-testid="home-contact-email-input" />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone Number *</Label>
                      <Input name="phone_number" type="tel" value={contactForm.phone_number} onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })} required placeholder="+961 XX XXX XXX" className="mt-1.5 h-11 rounded-xl bg-white/[0.05] border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:bg-white/[0.08]" data-testid="home-contact-phone-input" />
                    </div>

                    {/* Message */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Message *</Label>
                      <Textarea name="message" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} required rows={4} placeholder="Tell us what's on your mind..." className="mt-1.5 rounded-xl bg-white/[0.05] border-white/10 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:bg-white/[0.08] resize-none" data-testid="home-contact-message" />
                    </div>

                    {/* Photo upload */}
                    <div>
                      <ImageUploader value={contactForm.photo} onChange={(url) => setContactForm({ ...contactForm, photo: url })} label="Attach a screenshot (optional)" showUrlInput={false} />
                    </div>

                    {/* Submit */}
                    <Button type="submit" disabled={contactLoading} className="w-full rounded-xl h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-base font-bold shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/30" data-testid="home-contact-submit">
                      {contactLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Send Message</>}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========== ANIMATIONS CSS ========== */}
      <style>{`
        @keyframes orb1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px, 30px); } }
        @keyframes orb2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, -20px); } }
        @keyframes orb3 { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.2); } }
        .animate-orb1 { animation: orb1 8s ease-in-out infinite; }
        .animate-orb2 { animation: orb2 10s ease-in-out infinite; }
        .animate-orb3 { animation: orb3 12s ease-in-out infinite; }

        @keyframes hero-fade { from { opacity:0; } to { opacity:1; } }
        @keyframes hero-up { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        .animate-hero-fade { animation: hero-fade 0.8s ease-out 0.1s both; }
        .animate-hero-up { animation: hero-up 0.8s ease-out 0.2s both; }
        .animate-hero-up2 { animation: hero-up 0.8s ease-out 0.35s both; }
        .animate-hero-up3 { animation: hero-up 0.8s ease-out 0.5s both; }
        .animate-hero-fade2 { animation: hero-fade 0.8s ease-out 0.7s both; }

        @keyframes draw { from { stroke-dashoffset: 200; } to { stroke-dashoffset: 0; } }
        .animate-draw { stroke-dasharray: 200; animation: draw 1s ease-out 0.6s both; }

        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
        @media (max-width: 639px) {
          .animate-marquee { animation: marquee 8s linear infinite; }
        }

        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }

        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
      </div>
    </div>
  );
};

export default HomePage;
