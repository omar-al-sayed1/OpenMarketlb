import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Store, ChevronLeft, ChevronRight, Share2, Gift } from 'lucide-react';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/i18n';

const ProductCard = ({ product, onCartUpdate, wishlistIds = [], isSponsored = false, showShopName = false, sponsoredStyle = 'highlight', compact = false, hideShare = false, hideShopName = false, hideVariantCounts = false }) => {
  const { user } = useContext(AuthContext);
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isInWishlist, setIsInWishlist] = useState(wishlistIds.includes(product.id));
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [prevImageIndex, setPrevImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const price = product.discount_price || product.price;
  const hasDiscount = product.discount_price && product.discount_price < product.price;
  const discountPercent = hasDiscount ? Math.round(((product.price - product.discount_price) / product.price) * 100) : 0;
  
  const allVariantImages = [
    ...(product.colors || []).map(c => c.image_url).filter(Boolean),
    ...(product.shapes || []).map(s => s.image_url).filter(Boolean),
    ...(product.sizes || []).filter(s => s.image_url).map(s => s.image_url),
    product.size_variant_image
  ].filter(Boolean);
  const images = product.images?.length > 0 ? product.images : (allVariantImages.length > 0 ? allVariantImages : ['/placeholder.png']);
  const hasMultipleImages = images.length > 1;
  const minSwipeDistance = 50;

  useEffect(() => {
    setIsInWishlist(wishlistIds.includes(product.id));
  }, [wishlistIds, product.id]);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // If product has variants, redirect to product detail page
    const hasVariants = product.has_color_variants || product.has_size_variants || product.has_shape_variants || (product.colors && product.colors.length > 0);
    if (hasVariants) {
      toast.info('Please select a variant first');
      navigate(`/products/${product.id}`);
      return;
    }
    try {
      await api.cart.add({ product_id: product.id, quantity: 1 });
      toast.success('Added to cart!');
      window.dispatchEvent(new Event('cart-updated'));
      if (onCartUpdate) onCartUpdate();
    } catch (error) {
      if (error.response?.data?.detail?.includes('Insufficient stock')) {
        toast.error(`Only ${product.stock} available in stock`);
      } else {
        toast.error('Failed to add to cart');
      }
    }
  };

  const handleToggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isInWishlist) {
        await api.wishlist.remove(product.id);
        setIsInWishlist(false);
        toast.success('Removed from wishlist');
      } else {
        await api.wishlist.add(product.id);
        setIsInWishlist(true);
        toast.success('Added to wishlist!');
      }
    } catch (error) {
      toast.error('Failed to update wishlist');
    }
  };

  // Image navigation with transition
  const changeImage = (newIndex) => {
    if (isTransitioning) return;
    setPrevImageIndex(currentImageIndex);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentImageIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), 300);
    }, 150);
  };

  const nextImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    changeImage((currentImageIndex + 1) % images.length);
  };

  const prevImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    changeImage((currentImageIndex - 1 + images.length) % images.length);
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (e) => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && hasMultipleImages) {
      e.preventDefault();
      changeImage((currentImageIndex + 1) % images.length);
    }
    if (isRightSwipe && hasMultipleImages) {
      e.preventDefault();
      changeImage((currentImageIndex - 1 + images.length) % images.length);
    }
  };

  const handleCardClick = () => {
    // Track product click for recommendation engine
    try {
      const clicks = JSON.parse(localStorage.getItem('clicked_products') || '{}');
      clicks[product.id] = (clicks[product.id] || 0) + 1;
      localStorage.setItem('clicked_products', JSON.stringify(clicks));
      // Also record shop affinity
      if (product.shop_id) {
        const shops = JSON.parse(localStorage.getItem('viewed_shops') || '[]');
        shops.unshift(product.shop_id);
        localStorage.setItem('viewed_shops', JSON.stringify(shops.slice(0, 100)));
      }
      // Category affinity
      if (product.category_id) {
        const cats = JSON.parse(localStorage.getItem('viewed_categories') || '[]');
        cats.unshift(product.category_id);
        localStorage.setItem('viewed_categories', JSON.stringify(cats.slice(0, 100)));
      }
    } catch (e) {}
  };

  return (
    <Link to={`/products/${product.id}`} data-testid={`product-card-${product.id}`} onClick={handleCardClick}>
      <div className={`group bg-white rounded-md sm:rounded-xl overflow-hidden transition-all duration-300 hover-device:-translate-y-0.5 hover-device:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.1)] border border-slate-100 mx-[1px] my-[1px] sm:mx-0.5 sm:my-0.5 ${
        isSponsored && sponsoredStyle === 'highlight' ? 'border-amber-300 ring-1 ring-amber-200/50 shadow-[0_0_24px_-4px_rgba(251,191,36,0.2)]' : 'hover-device:border-slate-200'
      }`}>
        
        {/* Image Container - fixed square aspect ratio for uniform card sizes across the grid */}
        <div 
          className="relative w-full aspect-square overflow-hidden bg-slate-50"
          onTouchStart={hasMultipleImages ? onTouchStart : undefined}
          onTouchMove={hasMultipleImages ? onTouchMove : undefined}
          onTouchEnd={hasMultipleImages ? onTouchEnd : undefined}
        >
          <div className="relative w-full h-full">
            <img
              src={images[currentImageIndex] || '/placeholder.png'}
              alt={product.name}
              className={`w-full h-full object-cover transition-all duration-300 hover-device-group:scale-[1.04] ${isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
              loading="lazy"
              data-testid="product-image"
            />
            {/* Crossfade previous image */}
            {isTransitioning && (
              <img
                src={images[prevImageIndex] || '/placeholder.png'}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40 scale-95 transition-all duration-300"
              />
            )}
          </div>
          
          {/* Discount badge - yellow for shop sale, red for regular discount */}
          {product.shop_sale_discount ? (
            <div className="absolute top-1 left-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] sm:text-[11px] font-bold px-1 sm:px-1.5 py-0.5 rounded z-10 shadow-sm shadow-amber-500/30 tracking-tight leading-none" data-testid="shop-sale-badge">
              -{product.shop_sale_discount}%
            </div>
          ) : hasDiscount ? (
            <div className="absolute top-1 left-1 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[9px] sm:text-[11px] font-bold px-1 sm:px-1.5 py-0.5 rounded z-10 shadow-sm shadow-rose-500/30 tracking-tight leading-none" data-testid="discount-badge">
              -{discountPercent}%
            </div>
          ) : null}

          {/* Sponsored/AD badge - bottom left (smaller, responsive) */}
          {isSponsored && sponsoredStyle === 'highlight' && (
            <div className="absolute bottom-1.5 left-1.5 z-10" data-testid="sponsored-badge">
              <div className="flex items-center gap-0.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-900 text-[8px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-md shadow-amber-200/40 border border-amber-300/50 backdrop-blur-sm">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                <span className="tracking-wider uppercase">{isSponsored ? 'AD' : 'Sponsored'}</span>
              </div>
            </div>
          )}

          {/* Free Gift badge - responsive (smaller, mobile-first) */}
          {product.has_free_gift && (
            <div className="absolute top-1 left-1 z-10" data-testid="free-gift-badge" style={(hasDiscount || product.shop_sale_discount) ? { top: '22px' } : {}}>
              <div className="flex items-center gap-0.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] sm:text-[11px] font-bold px-1 sm:px-1.5 py-0.5 rounded shadow-sm shadow-pink-500/30 leading-none">
                <Gift className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>{t("product.freeGift") || "Gift"}</span>
              </div>
            </div>
          )}
          
          {/* Image counter badge */}
          {hasMultipleImages && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
              {currentImageIndex + 1}/{images.length}
            </div>
          )}

          {/* Image navigation arrows - hidden on touch/mobile devices */}
          {hasMultipleImages && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm transition-all opacity-0 group-hover:opacity-100 hidden sm:block"
                data-testid="prev-image-btn"
              >
                <ChevronLeft className="h-4 w-4 text-slate-700" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1 shadow-sm transition-all opacity-0 group-hover:opacity-100 hidden sm:block"
                data-testid="next-image-btn"
              >
                <ChevronRight className="h-4 w-4 text-slate-700" />
              </button>
            </>
          )}

          {/* Dot indicators for multiple images */}
          {hasMultipleImages && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1">
              {images.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentImageIndex ? 'bg-white w-3' : 'bg-white/60'
                  }`}
                />
              ))}
              {images.length > 5 && (
                <span className="text-white text-[8px] ml-0.5">+{images.length - 5}</span>
              )}
            </div>
          )}
          
          {/* Wishlist button */}
          <button
            onClick={handleToggleWishlist}
            className={`absolute top-1.5 right-1.5 rounded-full p-1.5 sm:p-2 transition-all duration-200 ${
              isInWishlist 
                ? 'bg-rose-500 text-white' 
                : 'bg-white/90 text-slate-400 hover:text-rose-500 hover:bg-white shadow-sm'
            }`}
            data-testid="wishlist-button"
          >
            <Heart className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isInWishlist ? 'fill-white' : ''}`} />
          </button>

          {/* Share button - hidden for sponsored cards (per requirement) */}
          {!isSponsored && !hideShare && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const url = `${window.location.origin}/products/${product.id}`;
              if (navigator.share) {
                navigator.share({ title: product.name, url }).catch(() => {});
              } else {
                try {
                  navigator.clipboard.writeText(url).then(() => {
                    toast.success('Product link copied!');
                  }).catch(() => {
                    const input = document.createElement('input');
                    input.value = url;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    toast.success('Product link copied!');
                  });
                } catch {
                  toast.info(`Link: ${url}`);
                }
              }
            }}
            className="absolute top-10 sm:top-12 right-1.5 sm:right-2.5 bg-white/90 text-slate-400 hover:text-violet-600 hover:bg-white rounded-full p-1.5 sm:p-2 shadow-sm transition-all duration-200 touch-device-show sm:opacity-0 sm:group-hover:opacity-100"
            data-testid="share-product-button"
          >
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          )}

          {/* Floating cart button - always visible on mobile */}
          <button
            onClick={handleAddToCart}
            className="absolute bottom-1.5 sm:bottom-2.5 right-1.5 sm:right-2.5 bg-white/95 hover:bg-violet-600 text-slate-700 hover:text-white rounded-full p-1.5 sm:p-2.5 shadow-md transition-all duration-200 hover:scale-105 mobile-cart-always-visible"
            data-testid="add-to-cart-button"
          >
            <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-2.5">
          {/* Shop name under image - shown when showShopName prop is true OR always show for sponsored cards */}
          {(showShopName || isSponsored) && !hideShopName && product.shop_name && product.shop_id && (
            <div className="flex items-center gap-1 mb-1 justify-between">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Store className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                <span
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/shop/${product.shop_id}`); }}
                  className="text-[11px] text-slate-400 hover:text-violet-600 cursor-pointer truncate"
                  data-testid="product-shop-link"
                >
                  {product.shop_name}
                </span>
              </div>
              {/* Low Stock badge inline with shop name */}
              {(!product.colors || product.colors.length === 0) && product.stock < 10 && product.stock > 0 && (
                <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium whitespace-nowrap ml-1 flex-shrink-0" data-testid="low-stock-warning">
                  {product.stock} {t("product.left") || "left"}
                </span>
              )}
            </div>
          )}
          {/* Original shop name row (when showShopName is not used) */}
          {!showShopName && !isSponsored && !hideShopName && product.shop_name && product.shop_id && (
            <div className="flex items-center gap-1 mb-1 justify-between">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Store className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                <span
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/shop/${product.shop_id}`); }}
                  className="text-[11px] text-slate-400 hover:text-violet-600 cursor-pointer truncate"
                  data-testid="product-shop-link"
                >
                  {product.shop_name}
                </span>
              </div>
              {/* Low Stock badge inline with shop name */}
              {(!product.colors || product.colors.length === 0) && product.stock < 10 && product.stock > 0 && (
                <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium whitespace-nowrap ml-1 flex-shrink-0" data-testid="low-stock-warning">
                  {product.stock} {t("product.left") || "left"}
                </span>
              )}
            </div>
          )}
          
          {/* Product name - bold & clear */}
          <h3 className="font-semibold text-xs sm:text-sm text-slate-800 line-clamp-2 mb-0.5 leading-snug" data-testid="product-name">
            {language === 'ar' && product.name_ar ? product.name_ar : product.name}
          </h3>
          
          {/* Description - subtle (hidden on compact/sponsored-picks cards) */}
          {!compact && (product.description || product.description_ar) && (
            <p className="text-[10px] text-slate-400 line-clamp-1 mb-1.5 leading-relaxed" data-testid="product-description">
              {language === 'ar' && product.description_ar ? product.description_ar : product.description}
            </p>
          )}
          
          {/* Price section */}
          <div className="flex items-center justify-between mt-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base font-bold text-slate-900" data-testid="product-price">
                ${price.toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="text-[10px] text-red-400 line-through font-normal" data-testid="original-price">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
            
            {/* Variant indicators - smaller size (hidden on compact/sponsored-picks cards and when explicitly hidden via prop, or on sponsored cards) */}
            {!compact && !hideVariantCounts && !isSponsored && product.colors && product.colors.length > 0 && (
              <span className="text-[9px] text-violet-600 bg-violet-50 px-1 py-0.5 rounded font-medium" data-testid="color-count">
                {product.colors.length} {product.colors.length === 1 ? 'color' : 'colors'}
              </span>
            )}
            
            {!compact && !hideVariantCounts && !isSponsored && product.sizes && product.sizes.length > 0 && (
              <span className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-medium">
                {product.sizes.length} sizes
              </span>
            )}
            
            {!compact && !hideVariantCounts && !isSponsored && product.shapes && product.shapes.length > 0 && (
              <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-medium">
                {product.shapes.length} shapes
              </span>
            )}

            {!compact && !hideVariantCounts && !isSponsored && product.types && product.types.length > 0 && (
              <span className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded font-medium" data-testid="type-count">
                {product.types.length} types
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
