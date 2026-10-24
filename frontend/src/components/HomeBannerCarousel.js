import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Crown } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Creative, swipable, autoplay hero banner carousel for the home page.
 * Admin can manage these via /admin/events (display_mode = "home_banner").
 *
 * Click an item → navigates to /products with the filters configured by admin:
 *   - filter_category_id / filter_category_ids
 *   - filter_gender (men/women/kids)
 *   - filter_search
 *   - filter_discount_only, filter_min_price, filter_max_price, filter_shop_id
 */
const HomeBannerCarousel = () => {
  const navigate = useNavigate();
  const CACHE_KEY = 'home_banners_cache_v1';
  const readCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.banners) ? parsed.banners : [];
    } catch { return []; }
  };
  const cached = readCache();
  const [banners, setBanners] = useState(cached);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(cached.length === 0);
  const trackRef = useRef(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.publicEvents.getHomeBanners();
      const arr = Array.isArray(data) ? data : [];
      setBanners(arr);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ banners: arr, ts: Date.now() })); } catch {}
    } catch (e) { /* ignore */ } finally { setLoading(false); }
  };

  // Keep active index in range if the banner set shrinks after a refresh.
  useEffect(() => {
    if (active >= banners.length) setActive(0);
  }, [banners.length, active]);

  // Autoplay
  useEffect(() => {
    if (banners.length <= 1 || paused) return undefined;
    const t = setInterval(() => setActive((i) => (i + 1) % banners.length), 5500);
    return () => clearInterval(t);
  }, [banners.length, paused]);

  const handleClick = useCallback((b) => {
    // If a sponsoring shop has paid to feature this banner → take the user directly to that shop
    const sponsor = b.current_sponsor || (Array.isArray(b.sponsoring_shops) && b.sponsoring_shops.length > 0 ? b.sponsoring_shops[b.sponsoring_shops.length - 1] : null);
    if (sponsor && sponsor.shop_id) {
      navigate(`/shop/${sponsor.shop_id}`);
      return;
    }
    const params = new URLSearchParams();
    const catIds = [
      ...(Array.isArray(b.filter_category_ids) ? b.filter_category_ids : []),
      ...(b.filter_category_id ? [b.filter_category_id] : []),
    ].filter(Boolean);
    if (catIds.length) params.set('categories', catIds.join(','));
    if (b.filter_gender) params.set('gender', b.filter_gender);
    if (b.filter_search) params.set('search', b.filter_search);
    if (b.filter_discount_only) params.set('discount_only', 'true');
    if (b.filter_min_price) params.set('min_price', String(b.filter_min_price));
    if (b.filter_max_price) params.set('max_price', String(b.filter_max_price));
    if (b.filter_shop_id) params.set('shop_id', b.filter_shop_id);
    if (b.cta_link && /^https?:\/\//i.test(b.cta_link)) {
      window.open(b.cta_link, '_blank');
      return;
    }
    if (b.cta_link && b.cta_link.startsWith('/')) {
      navigate(b.cta_link);
      return;
    }
    navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`);
  }, [navigate]);

  // Swipe handlers
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; touchDeltaX.current = 0; setPaused(true); };
  const onTouchMove = (e) => { touchDeltaX.current = e.touches[0].clientX - touchStartX.current; };
  const onTouchEnd = () => {
    const dx = touchDeltaX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) setActive((i) => (i + 1) % banners.length);
      else setActive((i) => (i - 1 + banners.length) % banners.length);
    }
    setTimeout(() => setPaused(false), 1500);
  };

  if (loading || banners.length === 0) return null;

  return (
    <section
      data-testid="home-banner-carousel"
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Track */}
      <div
        ref={trackRef}
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${active * 100}%)` }}
      >
        {banners.map((b, idx) => {
          const accent = b.banner_accent_color || 'from-violet-600 via-fuchsia-600 to-rose-500';
          const textColor = b.banner_text_color || '#ffffff';
          const activeSponsor = (b.current_sponsor && b.current_sponsor.shop_id) ? b.current_sponsor : null;
          const displayTitle = (activeSponsor && activeSponsor.sponsor_title) ? activeSponsor.sponsor_title : b.title;
          const displaySubtitle = (activeSponsor && activeSponsor.sponsor_subtitle)
            ? activeSponsor.sponsor_subtitle
            : (b.banner_subtitle || b.description);
          return (
            <button
              key={b.id || idx}
              type="button"
              onClick={() => handleClick(b)}
              className="group relative flex-shrink-0 w-full text-left focus:outline-none"
              data-testid={`home-banner-slide-${idx}`}
              aria-label={b.title || `Banner ${idx + 1}`}
            >
              <div className="relative aspect-[16/10] sm:aspect-[21/8] md:aspect-[24/8] w-full overflow-hidden">
                {/* Base creative gradient (always present; primary look for photo-less banners — also fallback color) */}
                <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
                {/* Background image (optional) — kept as-is, no darkening overlay */}
                {b.image_url && (
                  <img
                    src={b.image_url}
                    alt={b.title || ''}
                    className="absolute inset-0 w-full h-full object-cover transition-transform [transition-duration:2000ms] ease-out sm:group-hover:scale-110"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding={idx === 0 ? 'sync' : 'async'}
                    draggable="false"
                    {...(idx === 0 ? { fetchpriority: 'high' } : {})}
                  />
                )}
                {/* Decorative mesh glow for photo-less banners (keeps the color vivid) */}
                {!b.image_url && (
                  <>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_45%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_75%,rgba(255,255,255,0.18),transparent_45%)]" />
                  </>
                )}
                {/* Creative DESKTOP-ONLY hover: subtle brighten wash */}
                <div className="hidden sm:block absolute inset-0 bg-white/0 sm:group-hover:bg-white/[0.07] transition-colors duration-700 pointer-events-none" />
                {/* Creative DESKTOP-ONLY hover: diagonal shine sweep */}
                <div className="hidden sm:block absolute -inset-x-1/4 inset-y-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-65%] sm:group-hover:translate-x-[165%] transition-transform duration-[1500ms] ease-out pointer-events-none" />
                {/* Creative DESKTOP-ONLY hover: glowing ring frame */}
                <div className="hidden sm:block absolute inset-2.5 rounded-2xl ring-1 ring-white/0 sm:group-hover:ring-white/40 transition-all duration-700 pointer-events-none" />
                {/* VERY SOFT bottom-only shadow behind text (replaces the heavy black overlay) */}
                <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/40 via-black/8 to-transparent pointer-events-none" />
                {/* Floating particles */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-white/30 rounded-full"
                      style={{
                        left: `${(i * 13 + 7) % 100}%`,
                        top: `${(i * 19 + 23) % 100}%`,
                        animation: `float ${4 + (i % 3)}s ease-in-out infinite ${i * 0.3}s`,
                      }}
                    />
                  ))}
                </div>

                {/* Sponsored-by strip — prominently shows the ACTIVE sponsoring shop */}
                {activeSponsor ? (
                  <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 z-10" data-testid={`banner-active-sponsor-${idx}`}>
                    <div className="inline-flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-full pl-1 pr-3 py-1 shadow-lg border border-white/40">
                      {activeSponsor.logo ? (
                        <img src={activeSponsor.logo} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover" />
                      ) : (
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-bold">{(activeSponsor.shop_name || '?').charAt(0)}</span>
                      )}
                      <div className="leading-none">
                        <span className="block text-[7px] sm:text-[9px] font-bold uppercase tracking-wider text-amber-600">This shop sponsored</span>
                        <span className="block text-[10px] sm:text-xs font-bold text-slate-800 truncate max-w-[120px]">{activeSponsor.shop_name}</span>
                      </div>
                    </div>
                  </div>
                ) : Array.isArray(b.sponsoring_shops) && b.sponsoring_shops.length > 0 && (
                  <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 flex items-center gap-1.5 max-w-[60%] flex-wrap justify-end z-10" data-testid={`banner-sponsors-${idx}`}>
                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-white/90 bg-black/25 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/20">Sponsored by</span>
                    {b.sponsoring_shops.slice(0, 4).map((s, si) => (
                      <span key={si} className="inline-flex items-center gap-1 bg-white/90 text-slate-800 rounded-full pl-0.5 pr-2 py-0.5 text-[9px] sm:text-[11px] font-semibold shadow-sm">
                        {s.logo ? (
                          <img src={s.logo} alt="" className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover" />
                        ) : (
                          <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold">{(s.shop_name || '?').charAt(0)}</span>
                        )}
                        <span className="truncate max-w-[80px]">{s.shop_name}</span>
                      </span>
                    ))}
                    {b.sponsoring_shops.length > 4 && (
                      <span className="text-[9px] sm:text-[11px] font-semibold text-white bg-black/30 rounded-full px-2 py-0.5">+{b.sponsoring_shops.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Content — anchored to bottom-left, pairs with the soft bottom shadow */}
                <div className="relative h-full flex items-end px-4 sm:px-8 md:px-14 lg:px-20 pb-4 sm:pb-7 md:pb-9" style={{ color: textColor }}>
                  <div className="max-w-2xl transition-transform duration-500 ease-out sm:group-hover:-translate-y-1">
                    {activeSponsor ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-amber-400/95 text-slate-900 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider mb-2 sm:mb-3 shadow-lg" data-testid={`banner-sponsored-by-pill-${idx}`}>
                        <Crown className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                        <span>Sponsored by {activeSponsor.shop_name}</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[9px] sm:text-[11px] font-bold uppercase tracking-wider mb-2 sm:mb-3 shadow-lg sm:group-hover:bg-white/25 transition-colors duration-500">
                        <Sparkles className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                        <span>Featured</span>
                      </div>
                    )}
                    <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight leading-[1.1] mb-1 sm:mb-2 drop-shadow-xl" style={{ textShadow: '0 2px 14px rgba(0,0,0,0.35)' }}>
                      {displayTitle}
                    </h2>
                    {displaySubtitle && (
                      <p className="text-[10px] sm:text-xs md:text-sm font-medium opacity-95 mb-2 sm:mb-3.5 max-w-lg leading-snug drop-shadow line-clamp-2">
                        {displaySubtitle}
                      </p>
                    )}
                    <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full bg-white text-slate-900 font-bold text-[11px] sm:text-sm shadow-xl transition-all duration-300 sm:group-hover:gap-3 sm:group-hover:scale-105 sm:group-hover:shadow-2xl">
                      <span>{b.cta_text || 'Shop Now'}</span>
                      <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform sm:group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation Arrows (desktop) */}
      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActive((i) => (i - 1 + banners.length) % banners.length); }}
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/35 transition-all border border-white/30 shadow-xl"
            aria-label="Previous banner"
            data-testid="banner-prev-btn"
          >
            <ChevronLeft className="h-5 w-5 lg:h-6 lg:w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActive((i) => (i + 1) % banners.length); }}
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/35 transition-all border border-white/30 shadow-xl"
            aria-label="Next banner"
            data-testid="banner-next-btn"
          >
            <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/30 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive(i); }}
              className={`transition-all duration-300 rounded-full ${i === active ? 'w-6 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'}`}
              aria-label={`Go to banner ${i + 1}`}
              data-testid={`banner-dot-${i}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HomeBannerCarousel;
