import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Package, MapPin, Search, X, Map as MapIcon, ArrowRight, Sparkles, BadgeCheck, ChevronDown, Filter, Tag } from 'lucide-react';
import { api } from '../lib/api';
import { Input } from '@/components/ui/input';
import { useLanguage } from '../lib/i18n';
import EndOfPagePromos from '../components/EndOfPagePromos';

const ShopsPage = () => {
  const { t } = useLanguage();
  const [shops, setShops] = useState([]);
  const [filteredShops, setFilteredShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    fetchShops();
    fetchStates();
  }, []);

  useEffect(() => {
    let result = shops;
    if (selectedState) {
      result = result.filter(s => s.state?.toLowerCase() === selectedState.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name?.toLowerCase().includes(q) || 
        s.description?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.state?.toLowerCase().includes(q)
      );
    }
    setFilteredShops(result);
  }, [search, shops, selectedState]);

  const fetchShops = async () => {
    try {
      const { data } = await api.shops.getAll();
      setShops(data);
    } catch (error) {
      console.error('Failed to fetch shops', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const { data } = await api.states.getAll();
      setStates(data || []);
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="min-h-screen pt-4 pb-12 sm:pt-6" data-testid="shops-page">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="relative mb-8 overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-950" data-testid="shops-hero">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }} />
            <div className="absolute top-[-60px] left-[-50px] w-80 h-80 bg-violet-600/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-40px] right-[-40px] w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-[40%] left-[55%] w-56 h-56 bg-emerald-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
          
          <div className="relative text-center p-6 sm:p-10 lg:p-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 backdrop-blur-sm rounded-full text-white/90 text-xs font-medium mb-4 border border-white/10">
              <Store className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-bold">{shops.length}</span> trusted sellers on platform
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 tracking-tight" data-testid="shops-page-title">
              Discover Our{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">Shops</span>
                <svg className="absolute -bottom-1 left-0 w-full h-2" viewBox="0 0 100 8" preserveAspectRatio="none">
                  <path d="M0 7 Q25 0, 50 4 T100 3" fill="none" stroke="url(#shopGrad)" strokeWidth="2" strokeLinecap="round" />
                  <defs><linearGradient id="shopGrad" x1="0" x2="1"><stop offset="0%" stopColor="#85f8fd"/><stop offset="100%" stopColor="#f472b6"/></linearGradient></defs>
                </svg>
              </span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-6">
              {t('shops.subtitle') || 'Explore collections from trusted sellers across Lebanon'}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
              {/* Search */}
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('shops.searchPlaceholder') || 'Search shops...'}
                  className="pl-11 h-12 rounded-2xl bg-white/[0.06] backdrop-blur-md border-white/10 text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20 focus:bg-white/[0.09]"
                  data-testid="shops-search"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* State Select */}
              <div className="relative w-full sm:w-auto">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="h-12 pl-11 pr-10 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 text-white text-sm font-medium appearance-none cursor-pointer focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 focus:bg-white/[0.09] w-full sm:w-52 outline-none transition-all"
                  data-testid="shops-state-select"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <option value="" className="bg-slate-900 text-white">All States</option>
                  {states.map(s => (
                    <option key={s.id} value={s.name} className="bg-slate-900 text-white">{s.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
              
              {/* View on Map */}
              <Link
                to="/shops/map"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 flex-shrink-0"
                data-testid="view-on-map-btn"
              >
                <MapIcon className="h-4 w-4" />
                View on Map
              </Link>
            </div>

            {/* Active Filters */}
            {selectedState && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/20 border border-violet-400/30 rounded-full text-xs text-violet-300 font-medium">
                  <MapPin className="h-3 w-3" />
                  {selectedState}
                  <button onClick={() => setSelectedState('')} className="ml-1 hover:text-white transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Shops Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-pulse">
                <div className="h-36 bg-slate-200 dark:bg-slate-800" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Store className="h-16 w-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-300 font-semibold text-lg mb-1">
              {search || selectedState ? 'No shops found' : 'No shops available yet'}
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              {search || selectedState ? 'Try adjusting your filters' : 'Check back soon for new sellers'}
            </p>
            {(search || selectedState) && (
              <button
                onClick={() => { setSearch(''); setSelectedState(''); }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-sm font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                data-testid="clear-filters-btn"
              >
                <X className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="shops-grid">
            {filteredShops.map((shop, idx) => (
              <Link
                key={shop.id}
                to={`/shop/${shop.id}`}
                className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
                data-testid={`shop-card-${shop.id}`}
              >
                {/* Banner / Cover Photo */}
                <div className="relative h-40 overflow-hidden">
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
                  
                  {/* Logo floating */}
                  <div className="absolute bottom-3 left-4 flex items-end gap-3">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center overflow-hidden shadow-xl group-hover:scale-105 transition-transform">
                      {shop.logo ? (
                        <img src={shop.logo} alt={shop.name} className="w-full h-full object-cover" />
                      ) : (
                        <Store className="h-7 w-7 text-white" />
                      )}
                    </div>
                    <div className="pb-0.5">
                      <h3 className="font-bold text-white text-base drop-shadow-lg leading-tight">{shop.name}</h3>
                      {shop.state && (
                        <p className="text-white/70 text-[11px] flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" /> {shop.state}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {shop.is_verified && (
                      <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider shadow-lg flex items-center gap-0.5" data-testid={`verified-badge-${shop.id}`}>
                        <BadgeCheck className="h-3 w-3" /> VERIFIED
                      </span>
                    )}
                  </div>

                  {/* Sale badge on cover */}
                  {shop.has_active_sale && shop.active_sale_percent && (
                    <div className="absolute top-2 left-2 z-10" data-testid={`shop-sale-badge-${shop.id}`}>
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

                {/* Content */}
                <div className="p-4">
                  {shop.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">{shop.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {shop.products_count > 0 && (
                        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-full">
                          <Package className="h-3 w-3" /> {shop.products_count}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Visit <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer count */}
        <p className="text-center text-sm text-slate-400 mt-8">
          {filteredShops.length} {filteredShops.length === 1 ? 'shop' : 'shops'} {selectedState ? `in ${selectedState}` : 'available'}
        </p>
      </div>
      {/* Sponsored add-ons + Recommended (with interleaved sponsored carousels) */}
      <div className="pb-8" data-testid="shops-end-promos">
        <EndOfPagePromos />
      </div>
    </div>
  );
};

export default ShopsPage;
