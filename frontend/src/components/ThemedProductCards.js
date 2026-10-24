import React, { useContext, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Tag, Share2, Eye, Gift, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { toast } from 'sonner';
import ProductCard from './ProductCard';

// Shared helpers
const formatPrice = (p) => `$${(p || 0).toFixed(2)}`;
const getDiscount = (p) => p.discount_price && p.discount_price < p.price ? Math.round(((p.price - p.discount_price) / p.price) * 100) : 0;
const imgSrc = (p) => p.images?.[0] || 'https://placehold.co/400x400/f1f5f9/94a3b8?text=No+Image';

const hasMultipleVariants = (product) => {
  const colorCount = (product.colors || []).filter(c => c.enabled !== false).length;
  const sizeCount = (product.sizes || []).filter(s => s.enabled !== false).length;
  const shapeCount = (product.shapes || []).filter(s => s.enabled !== false).length;
  return colorCount > 0 || sizeCount > 0 || shapeCount > 0;
};

// Shared action handlers
const useCardActions = () => {
  const navigate = useNavigate();
  const handleAddToCart = async (e, productId, product) => {
    e.preventDefault(); e.stopPropagation();
    if (product && hasMultipleVariants(product)) {
      navigate(`/products/${productId}`);
      toast.info('Please select a variant first');
      return;
    }
    try { await api.cart.add({ product_id: productId, quantity: 1 }); toast.success('Added to cart!'); window.dispatchEvent(new Event('cart-updated')); }
    catch { toast.error('Failed to add to cart'); }
  };
  const handleWishlist = async (e, productId, isIn, setFn) => {
    e.preventDefault(); e.stopPropagation();
    try { if (isIn) { await api.wishlist.remove(productId); setFn(false); toast.success('Removed'); } else { await api.wishlist.add(productId); setFn(true); toast.success('Added to wishlist!'); } }
    catch { toast.error('Failed'); }
  };
  const handleShare = (e, product) => {
    e.preventDefault(); e.stopPropagation();
    const url = `${window.location.origin}/products/${product.id}`;
    if (navigator.share) { navigator.share({ title: product.name, url }).catch(() => {}); }
    else { navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => toast.info(url)); }
  };
  return { handleAddToCart, handleWishlist, handleShare };
};

// ============ SHARED IMAGE SLIDER ============
const ImageSlider = ({ images, alt, className = '', overlay = null }) => {
  const [idx, setIdx] = useState(0);
  const touchStart = useRef(null);
  const touchEnd = useRef(null);
  const imgs = images?.length > 0 ? images : ['https://placehold.co/400x400/f1f5f9/94a3b8?text=No+Image'];
  const hasMulti = imgs.length > 1;

  const next = (e) => { e?.preventDefault(); e?.stopPropagation(); setIdx((idx + 1) % imgs.length); };
  const prev = (e) => { e?.preventDefault(); e?.stopPropagation(); setIdx((idx - 1 + imgs.length) % imgs.length); };
  const onTouchStart = (e) => { touchStart.current = e.targetTouches[0].clientX; touchEnd.current = null; };
  const onTouchMove = (e) => { touchEnd.current = e.targetTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (!touchStart.current || !touchEnd.current) return;
    const dist = touchStart.current - touchEnd.current;
    if (Math.abs(dist) > 40) { if (dist > 0) next(e); else prev(e); }
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}
      onTouchStart={hasMulti ? onTouchStart : undefined}
      onTouchMove={hasMulti ? onTouchMove : undefined}
      onTouchEnd={hasMulti ? onTouchEnd : undefined}
    >
      <img src={imgs[idx]} alt={alt} className="w-full h-full object-cover transition-opacity duration-300" loading="lazy" />
      {overlay}
      {hasMulti && (
        <>
          <button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center z-10"><ChevronLeft className="h-3.5 w-3.5 text-slate-700" /></button>
          <button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center z-10"><ChevronRight className="h-3.5 w-3.5 text-slate-700" /></button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {imgs.slice(0, 5).map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-3' : 'bg-white/50'}`} />
            ))}
            {imgs.length > 5 && <span className="text-white text-[7px] ml-0.5">+{imgs.length - 5}</span>}
          </div>
        </>
      )}
    </div>
  );
};

// Gift Badge component
const GiftBadge = ({ product, hasDiscountBadge = false, style = 'default' }) => {
  if (!product.has_free_gift) return null;
  const top = hasDiscountBadge ? { top: '28px' } : {};
  if (style === 'dark') return <span className="absolute top-2 left-2 bg-pink-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10" style={top}><Gift className="h-2 w-2" /> Gift</span>;
  if (style === 'gold') return <span className="absolute top-2 left-2 bg-amber-500 text-zinc-900 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 z-10" style={top}><Gift className="h-2 w-2" /> Gift</span>;
  return <span className="absolute top-1.5 left-1.5 bg-pink-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 z-10" style={top}><Gift className="h-2.5 w-2.5" /> Gift</span>;
};

// ============ CLASSIC ============
export const ClassicCard = ({ product, wishlistIds = [] }) => (
  <ProductCard product={product} wishlistIds={wishlistIds} hideShopName={true} />
);

// ============ MAGAZINE — editorial tall, name/price on hover (laptop), no shadow (phone) ============
export const MagazineCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist, handleShare } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block rounded-2xl overflow-hidden transition-all duration-500 transform hover:-translate-y-1 border border-slate-100 hover:border-violet-200 bg-white hover:shadow-xl" data-testid={`product-card-${product.id}`}>
      <div className="aspect-[3/4] relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-110 transition-transform duration-700" />
        {/* Phone: clean bottom area; Laptop: overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} />
        {getDiscount(product) > 0 && <span className="absolute top-1.5 left-1.5 bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md z-10">-{getDiscount(product)}%</span>}
        <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`p-1.5 sm:p-2 rounded-full shadow-lg transition-all ${liked ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-600 hover:text-rose-500'}`}><Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${liked ? 'fill-white' : ''}`} /></button>
          <button onClick={(e) => handleShare(e, product)} className="p-1.5 sm:p-2 rounded-full bg-white/90 text-slate-600 hover:text-violet-600 shadow-lg"><Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
        </div>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-14 sm:bottom-16 right-3 p-2 sm:p-2.5 rounded-full bg-white/95 text-slate-700 hover:bg-rose-500 hover:text-white shadow-lg transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
        {/* Name/Price: always on phone (no shadow), hover on laptop */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300">
          <h3 className="text-sm sm:text-lg font-bold text-white mb-0.5 sm:mb-1 drop-shadow-none sm:drop-shadow-lg line-clamp-2">{product.name}</h3>
          <div className="flex items-center gap-2">
            {product.discount_price ? (<><span className="text-base sm:text-lg font-bold text-emerald-300">{formatPrice(product.discount_price)}</span><span className="text-xs sm:text-sm text-white/60 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base sm:text-lg font-bold text-white">{formatPrice(product.price)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

// ============ LUXURY — dark, gold ============
export const LuxuryCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block bg-zinc-900 border border-zinc-800 overflow-hidden hover:border-amber-600/50 transition-all duration-500" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-700" />
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} style="gold" />
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-3 right-3 p-2 rounded-full transition-all z-10 ${liked ? 'bg-amber-500 text-white' : 'bg-black/50 text-zinc-300 hover:text-amber-400'}`}><Heart className={`h-4 w-4 ${liked ? 'fill-white' : ''}`} /></button>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-3 right-3 p-2.5 rounded-none bg-amber-500/90 text-zinc-900 hover:bg-amber-400 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-4 w-4" /></button>
      </div>
      <div className="p-4 border-t border-zinc-800">
        <h3 className="text-sm font-light text-zinc-300 tracking-wider uppercase truncate group-hover:text-amber-400 transition-colors">{product.name}</h3>
        <div className="flex items-center justify-between mt-3">
          {product.discount_price ? (<div className="flex items-center gap-3"><span className="text-lg font-light text-amber-400 tracking-wider">{formatPrice(product.discount_price)}</span><span className="text-sm text-zinc-600 line-through">{formatPrice(product.price)}</span></div>) : <span className="text-lg font-light text-amber-400 tracking-wider">{formatPrice(product.price)}</span>}
          {product.average_rating > 0 && <div className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" /><span className="text-xs text-zinc-500">{product.average_rating?.toFixed(1)}</span></div>}
        </div>
      </div>
    </Link>
  );
};

// ============ MINIMAL ============
export const MinimalCard = ({ product }) => {
  const { handleAddToCart, handleShare } = useCardActions();
  return (
    <Link to={`/products/${product.id}`} className="group block py-6 border-b border-slate-100 hover:bg-slate-50/50 transition-all" data-testid={`product-card-${product.id}`}>
      <div className="flex gap-6 items-start">
        <div className="w-32 h-32 flex-shrink-0 overflow-hidden rounded-lg bg-slate-50 relative">
          <ImageSlider images={product.images} alt={product.name} />
          <GiftBadge product={product} style="dark" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-slate-900 group-hover:text-slate-600 transition-colors">{product.name}</h3>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{product.description}</p>
          <div className="flex items-center gap-3 mt-3">
            {product.discount_price ? (<><span className="text-lg font-medium text-slate-900">{formatPrice(product.discount_price)}</span><span className="text-sm text-slate-400 line-through">{formatPrice(product.price)}</span>{getDiscount(product) > 0 && <span className="text-xs text-red-500 font-medium">-{getDiscount(product)}%</span>}</>) : <span className="text-lg font-medium text-slate-900">{formatPrice(product.price)}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={(e) => handleAddToCart(e, product.id, product)} className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-all"><ShoppingCart className="h-4 w-4" /></button>
          <button onClick={(e) => handleShare(e, product)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"><Share2 className="h-4 w-4" /></button>
        </div>
      </div>
    </Link>
  );
};

// ============ CATALOG ============
export const CatalogCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart } = useCardActions();
  return (
    <Link to={`/products/${product.id}`} className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md hover:border-sky-300 transition-all" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden bg-slate-50">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-105 transition-transform" />
        {getDiscount(product) > 0 && <span className="absolute top-1 left-1 bg-sky-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-10">-{getDiscount(product)}%</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} style="dark" />
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-1 right-1 p-1.5 rounded bg-sky-500 text-white hover:bg-sky-600 shadow transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-3.5 w-3.5" /></button>
      </div>
      <div className="p-2">
        <h3 className="text-xs font-medium text-slate-800 truncate">{product.name}</h3>
        <div className="flex items-center justify-between mt-1">
          {product.discount_price ? (<><span className="text-sm font-bold text-sky-600">{formatPrice(product.discount_price)}</span><span className="text-[10px] text-slate-400 line-through">{formatPrice(product.price)}</span></>) : <span className="text-sm font-bold text-slate-900">{formatPrice(product.price)}</span>}
        </div>
      </div>
    </Link>
  );
};

// ============ SHOWCASE — hover reveals on laptop, clean on phone ============
export const ShowcaseCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist, handleShare } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2" data-testid={`product-card-${product.id}`}>
      <div className="aspect-[4/3] relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-105 transition-transform duration-700" />
        {/* Purple overlay: only on laptop hover */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-purple-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {getDiscount(product) > 0 && <span className="absolute top-3 sm:top-4 left-3 sm:left-4 bg-white/90 text-purple-700 text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg z-10">-{getDiscount(product)}% OFF</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} />
        {/* Icons: smaller on phone, always visible; normal on laptop, hover */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 flex gap-1.5 sm:gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`p-1.5 sm:p-2.5 rounded-full shadow-lg ${liked ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-600'}`}><Heart className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${liked ? 'fill-white' : ''}`} /></button>
          <button onClick={(e) => handleShare(e, product)} className="p-1.5 sm:p-2.5 rounded-full bg-white/90 text-slate-600 shadow-lg"><Share2 className="h-3.5 w-3.5 sm:h-5 sm:w-5" /></button>
          <button onClick={(e) => handleAddToCart(e, product.id, product)} className="p-1.5 sm:p-2.5 rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700"><ShoppingCart className="h-3.5 w-3.5 sm:h-5 sm:w-5" /></button>
        </div>
        {/* Content: visible on phone (no purple bg), hover on laptop */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-6 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 z-10">
          <h3 className="text-base sm:text-2xl font-bold text-white mb-0 sm:mb-2 drop-shadow-lg">{product.name}</h3>
          <p className="hidden sm:block text-sm text-white/70 mb-3 line-clamp-2">{product.description}</p>
          <div className="flex items-center gap-2 sm:gap-3">
            {product.discount_price ? (<><span className="text-lg sm:text-2xl font-bold text-white">{formatPrice(product.discount_price)}</span><span className="text-sm sm:text-lg text-white/50 line-through">{formatPrice(product.price)}</span></>) : <span className="text-lg sm:text-2xl font-bold text-white">{formatPrice(product.price)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

// ============ MARKETPLACE ============
export const MarketplaceCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-lg hover:border-emerald-200 transition-all" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-slate-50 to-white">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-105 transition-transform" />
        {getDiscount(product) > 0 && <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 z-10"><Tag className="h-3 w-3" /> -{getDiscount(product)}%</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} />
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-2 right-2 p-1.5 rounded-full shadow transition-all z-10 ${liked ? 'bg-rose-500 text-white' : 'bg-white/90 text-slate-400'}`}><Heart className={`h-3.5 w-3.5 ${liked ? 'fill-white' : ''}`} /></button>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-2 right-2 p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-md transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-4 w-4" /></button>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-emerald-600">{product.name}</h3>
        <div className="flex items-baseline gap-2 mt-1.5">
          {product.discount_price ? (<><span className="text-base font-bold text-emerald-600">{formatPrice(product.discount_price)}</span><span className="text-xs text-slate-400 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base font-bold text-slate-900">{formatPrice(product.price)}</span>}
        </div>
      </div>
    </Link>
  );
};

// ============ SOCIAL — no shadow on phone, icons visible without hover on phone, smaller icons ============
export const SocialCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden rounded-2xl sm:shadow-md sm:group-hover:shadow-xl transition-all">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-110 transition-transform duration-500" />
        {/* Shadow overlay: only on laptop hover */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <GiftBadge product={product} />
        {/* Wishlist: always visible, smaller on phone */}
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-2 right-2 p-1.5 sm:p-2 rounded-full shadow-lg transition-all z-10 ${liked ? 'bg-pink-500 text-white scale-110' : 'bg-white/80 text-slate-500'}`}><Heart className={`h-3 w-3 sm:h-4 sm:w-4 ${liked ? 'fill-white animate-pulse' : ''}`} /></button>
        {/* Bottom bar: always visible on phone, hover on laptop */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform z-10">
          <div className="flex items-center justify-between">
            <div><h3 className="text-xs sm:text-sm font-bold text-white truncate">{product.name}</h3><span className="text-xs sm:text-sm font-bold text-pink-300">{formatPrice(product.discount_price || product.price)}</span></div>
            <button onClick={(e) => handleAddToCart(e, product.id, product)} className="p-1.5 sm:p-2 rounded-full bg-white text-pink-600 hover:bg-pink-500 hover:text-white shadow-lg transition-all"><ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" /></button>
          </div>
        </div>
        {getDiscount(product) > 0 && <span className="absolute top-2 left-2 bg-pink-500 text-white text-[9px] sm:text-[10px] font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow z-10">-{getDiscount(product)}%</span>}
      </div>
    </Link>
  );
};

// ============ PROFESSIONAL — icon-only cart on phone, 3-dot menu, taller photo ============
export const ProfessionalCard = ({ product }) => {
  const { handleAddToCart, handleWishlist, handleShare } = useCardActions();
  const [liked, setLiked] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <Link to={`/products/${product.id}`} className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-all" data-testid={`product-card-${product.id}`}>
      <div className="aspect-[4/3] sm:aspect-[4/3] relative overflow-hidden bg-slate-50" style={{ minHeight: '180px' }}>
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-102 transition-transform" />
        <GiftBadge product={product} />
        {/* 3-dot menu (phone only) */}
        <div className="sm:hidden absolute top-2 right-2 z-20">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1.5 rounded-full bg-white/90 text-slate-600 shadow-md">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute top-8 right-0 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[120px] z-30">
              <button onClick={(e) => { handleShare(e, product); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Share2 className="h-3 w-3" /> Share</button>
              <button onClick={(e) => { handleWishlist(e, product.id, liked, setLiked); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Heart className={`h-3 w-3 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} /> {liked ? 'Saved' : 'Wishlist'}</button>
            </div>
          )}
        </div>
        {/* Desktop: full add to cart button */}
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-3 right-3 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-md transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10 hidden sm:flex items-center gap-1 px-3 py-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Add to Cart</button>
        {/* Phone: icon-only cart button */}
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-2 right-2 p-2 rounded-lg bg-blue-600 text-white shadow-md sm:hidden z-10"><ShoppingCart className="h-3.5 w-3.5" /></button>
      </div>
      <div className="p-3 sm:p-4 border-t border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">{product.name}</h3>
        <p className="text-xs text-slate-500 line-clamp-1 mb-2 hidden sm:block">{product.description}</p>
        <div className="flex items-center justify-between">
          {product.discount_price ? (<div><span className="text-base font-bold text-blue-700">{formatPrice(product.discount_price)}</span><span className="text-xs text-slate-400 line-through ml-2">{formatPrice(product.price)}</span></div>) : <span className="text-base font-bold text-slate-900">{formatPrice(product.price)}</span>}
          {product.average_rating > 0 && <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded"><Star className="h-3 w-3 text-blue-500 fill-blue-500" /><span className="text-xs text-blue-700 font-medium">{product.average_rating?.toFixed(1)}</span></div>}
        </div>
      </div>
    </Link>
  );
};

// ============ SEASONAL ============
export const SeasonalCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group bg-white rounded-xl overflow-hidden border-2 border-amber-200 hover:border-amber-400 shadow-sm hover:shadow-lg transition-all" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-105 transition-transform" />
        {getDiscount(product) > 0 && <span className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg animate-pulse z-10">-{getDiscount(product)}% DEAL</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} />
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-2 right-2 p-1.5 rounded-full shadow z-10 ${liked ? 'bg-red-500 text-white' : 'bg-white/90 text-amber-600'}`}><Heart className={`h-3.5 w-3.5 ${liked ? 'fill-white' : ''}`} /></button>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-2 right-2 p-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:scale-110 transition-transform opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-4 w-4" /></button>
      </div>
      <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50">
        <h3 className="text-sm font-bold text-amber-900 truncate">{product.name}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          {product.discount_price ? (<><span className="text-base font-bold text-orange-600">{formatPrice(product.discount_price)}</span><span className="text-xs text-amber-700/50 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base font-bold text-amber-900">{formatPrice(product.price)}</span>}
        </div>
      </div>
    </Link>
  );
};

// ============ VIDEO — hover reveals on laptop, clean on phone, smaller icons ============
export const VideoCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-red-500/50 transition-all" data-testid={`product-card-${product.id}`}>
      <div className="aspect-[3/4] relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="brightness-90 group-hover:scale-105 transition-all duration-500" />
        {/* Dark overlay: only on laptop hover */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Icons: always visible + smaller on phone; hover on laptop */}
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex flex-col gap-1.5 sm:gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`p-1.5 sm:p-2 rounded-full shadow-lg ${liked ? 'bg-red-500 text-white' : 'bg-zinc-800/80 text-zinc-300'}`}><Heart className={`h-3 w-3 sm:h-4 sm:w-4 ${liked ? 'fill-white' : ''}`} /></button>
          <button onClick={(e) => handleAddToCart(e, product.id, product)} className="p-1.5 sm:p-2 rounded-full bg-red-600/90 text-white hover:bg-red-500 shadow-lg"><ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" /></button>
        </div>
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} style="dark" />
        {/* Name/Price: always visible on phone, hover on laptop */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 sm:translate-y-full sm:group-hover:translate-y-0 transition-transform duration-300 z-10">
          <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5 sm:mb-1">{product.name}</h3>
          <div className="flex items-center gap-2">
            {product.discount_price ? (<><span className="text-base sm:text-lg font-bold text-red-400">{formatPrice(product.discount_price)}</span><span className="text-[10px] sm:text-xs text-zinc-500 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base sm:text-lg font-bold text-white">{formatPrice(product.price)}</span>}
          </div>
        </div>
        {getDiscount(product) > 0 && <span className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg z-10">-{getDiscount(product)}%</span>}
      </div>
    </Link>
  );
};

// ============ ARABIC HERITAGE ============
export const ArabicHeritageCard = ({ product }) => {
  const { handleAddToCart, handleShare } = useCardActions();
  return (
    <Link to={`/products/${product.id}`} className="group bg-stone-50 rounded-xl overflow-hidden border-2 border-amber-200/50 hover:border-amber-500/50 shadow-sm hover:shadow-lg transition-all" data-testid={`product-card-${product.id}`} dir="rtl">
      <div className="aspect-square relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-105 transition-transform" />
        {getDiscount(product) > 0 && <span className="absolute top-2 right-2 bg-amber-700 text-amber-100 text-[10px] font-bold px-2 py-0.5 rounded z-10">-{getDiscount(product)}%</span>}
        <GiftBadge product={product} />
        <div className="absolute bottom-2 left-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <button onClick={(e) => handleAddToCart(e, product.id, product)} className="p-2 rounded-lg bg-amber-700 text-amber-100 hover:bg-amber-600 shadow"><ShoppingCart className="h-4 w-4" /></button>
          <button onClick={(e) => handleShare(e, product)} className="p-2 rounded-lg bg-stone-200 text-amber-800 hover:bg-stone-300 shadow"><Share2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="p-3 bg-gradient-to-b from-stone-50 to-amber-50/30 border-t-2 border-amber-100">
        <h3 className="text-sm font-bold text-amber-900 truncate" style={{ fontFamily: 'Georgia, serif' }}>{product.name}</h3>
        <div className="flex items-center gap-2 mt-1.5 justify-end">
          {product.discount_price ? (<><span className="text-base font-bold text-amber-800">{formatPrice(product.discount_price)}</span><span className="text-xs text-amber-600/50 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base font-bold text-amber-900">{formatPrice(product.price)}</span>}
        </div>
      </div>
    </Link>
  );
};

// ============ FASHION BOUTIQUE — no purple overlay on phone ============
export const FashionBoutiqueCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  const colorCount = (product.colors || []).length;
  const sizeCount = (product.sizes || []).length;
  return (
    <Link to={`/products/${product.id}`} className="group block bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 border border-rose-100/50" data-testid={`product-card-${product.id}`}>
      <div className="aspect-[3/4] relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-110 transition-transform duration-700" />
        {/* Purple overlay: laptop only */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-fuchsia-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {getDiscount(product) > 0 && <span className="absolute top-3 left-3 bg-fuchsia-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg z-10">-{getDiscount(product)}%</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} />
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-3 right-3 p-1.5 sm:p-2 rounded-full shadow-lg transition-all z-10 ${liked ? 'bg-fuchsia-500 text-white' : 'bg-white/90 text-fuchsia-400 hover:text-fuchsia-600'}`}><Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${liked ? 'fill-white' : ''}`} /></button>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-3 right-3 p-2 sm:p-2.5 rounded-full bg-fuchsia-500 text-white shadow-lg hover:bg-fuchsia-600 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
      </div>
      <div className="p-3.5">
        <h3 className="text-sm font-semibold text-slate-800 truncate">{product.name}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          {colorCount > 0 && <span className="text-[9px] text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded-full font-medium">{colorCount} colors</span>}
          {sizeCount > 0 && <span className="text-[9px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full font-medium">{sizeCount} sizes</span>}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            {product.discount_price ? (<><span className="text-base font-bold text-fuchsia-600">{formatPrice(product.discount_price)}</span><span className="text-xs text-slate-400 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base font-bold text-slate-800">{formatPrice(product.price)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

// ============ NEON NIGHT ============
export const NeonNightCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="brightness-90 group-hover:brightness-100 group-hover:scale-105 transition-all duration-500" />
        {getDiscount(product) > 0 && <span className="absolute top-2 left-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg z-10">-{getDiscount(product)}%</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} style="dark" />
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 ${liked ? 'bg-cyan-500 text-white' : 'bg-gray-800/80 text-gray-400 hover:text-cyan-400'}`}><Heart className={`h-3.5 w-3.5 ${liked ? 'fill-white' : ''}`} /></button>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-2 right-2 p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-lg hover:shadow-cyan-500/30 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-4 w-4" /></button>
      </div>
      <div className="p-3 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-100 truncate">{product.name}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          {product.discount_price ? (<><span className="text-base font-bold text-cyan-400">{formatPrice(product.discount_price)}</span><span className="text-xs text-gray-600 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base font-bold text-gray-200">{formatPrice(product.price)}</span>}
        </div>
      </div>
    </Link>
  );
};

// ============ EARTH & ORGANIC ============
export const EarthOrganicCard = ({ product, wishlistIds = [] }) => {
  const { handleAddToCart, handleWishlist } = useCardActions();
  const [liked, setLiked] = React.useState(wishlistIds.includes(product.id));
  return (
    <Link to={`/products/${product.id}`} className="group block bg-white rounded-xl overflow-hidden border border-stone-200 hover:border-amber-400/50 shadow-sm hover:shadow-md transition-all" data-testid={`product-card-${product.id}`}>
      <div className="aspect-square relative overflow-hidden">
        <ImageSlider images={product.images} alt={product.name} className="group-hover:scale-105 transition-transform duration-500" />
        {getDiscount(product) > 0 && <span className="absolute top-2 left-2 bg-stone-700 text-stone-100 text-[10px] font-bold px-2 py-0.5 rounded-lg z-10">-{getDiscount(product)}%</span>}
        <GiftBadge product={product} hasDiscountBadge={getDiscount(product) > 0} />
        <button onClick={(e) => handleWishlist(e, product.id, liked, setLiked)} className={`absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 ${liked ? 'bg-amber-600 text-white' : 'bg-white/80 text-stone-500 hover:text-amber-600'}`}><Heart className={`h-3.5 w-3.5 ${liked ? 'fill-white' : ''}`} /></button>
        <button onClick={(e) => handleAddToCart(e, product.id, product)} className="absolute bottom-2 right-2 p-2 rounded-lg bg-stone-700 text-stone-100 hover:bg-stone-600 shadow-md transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"><ShoppingCart className="h-4 w-4" /></button>
      </div>
      <div className="p-3 bg-gradient-to-b from-white to-stone-50">
        <h3 className="text-sm font-semibold text-stone-800 truncate">{product.name}</h3>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            {product.discount_price ? (<><span className="text-base font-bold text-stone-800">{formatPrice(product.discount_price)}</span><span className="text-xs text-stone-400 line-through">{formatPrice(product.price)}</span></>) : <span className="text-base font-bold text-stone-800">{formatPrice(product.price)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

// ============ CARD SELECTOR ============
const themeCardMap = {
  classic: ClassicCard,
  magazine: MagazineCard,
  luxury: LuxuryCard,
  minimal: MinimalCard,
  catalog: CatalogCard,
  showcase: ShowcaseCard,
  marketplace: MarketplaceCard,
  social: SocialCard,
  professional: ProfessionalCard,
  seasonal: SeasonalCard,
  video: VideoCard,
  arabic_heritage: ArabicHeritageCard,
  fashion_boutique: FashionBoutiqueCard,
  neon_night: NeonNightCard,
  earth_organic: EarthOrganicCard,
};

export function getThemedCard(themeKey) {
  return themeCardMap[themeKey] || ClassicCard;
}

export default themeCardMap;
