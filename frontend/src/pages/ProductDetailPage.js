import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Heart, Minus, Plus, Store, ChevronLeft, ChevronRight, Star, ThumbsUp, User, CheckCircle, MessageSquare, Send, Share2, X, ZoomIn, LogIn, Gift, Package, Palette, Ruler, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthContext } from '../App';
import { api } from '../lib/api';
import { toast } from 'sonner';
import ProductCard from '../components/ProductCard';
import ProductRecommendations from '../components/ProductRecommendations';
import SponsoredRow from '../components/SponsoredRow';
import TierBadge from '../components/TierBadge';
import { useLanguage } from '../lib/i18n';

const ProductDetailPage = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, average: 0, distribution: {} });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, title: '', comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [messageToShop, setMessageToShop] = useState('');

  const minSwipeDistance = 50;

  useEffect(() => {
    fetchProduct();
    fetchWishlist();
    fetchReviews();
  }, [id]);

  useEffect(() => {
    setCurrentImageIndex(0);
    setSelectedColor(null);
    setSelectedSize(null);
    setSelectedShape(null);
  }, [product?.id]);

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    if (color.image_url && product) {
      const allImgs = getAllImages();
      const idx = allImgs.findIndex(img => img === color.image_url);
      if (idx !== -1) animateToImage(idx);
    }
  };

  const handleSizeSelect = (size) => {
    setSelectedSize(size);
  };

  const handleShapeSelect = (shape) => {
    setSelectedShape(shape);
    if (shape.image_url && product) {
      const allImgs = getAllImages();
      const idx = allImgs.findIndex(img => img === shape.image_url);
      if (idx !== -1) animateToImage(idx);
    }
  };

  const fetchProduct = async () => {
    try {
      const { data } = await api.products.getById(id);
      setProduct(data);
      fetchSimilarProducts(data.category_id || data.category_ids?.[0], data.id);
      try { 
        api.tracking.view(id); 
        // Store in localStorage for recommended sorting
        const viewed = JSON.parse(localStorage.getItem('viewed_products') || '[]');
        if (!viewed.includes(id)) {
          viewed.unshift(id);
          localStorage.setItem('viewed_products', JSON.stringify(viewed.slice(0, 50)));
        }
      } catch (e) {}
    } catch (error) {
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data } = await api.reviews.getByProduct(id);
      setReviews(data.reviews || []);
      setReviewStats({ total: data.total_reviews || 0, average: data.average_rating || 0, distribution: data.distribution || {} });
    } catch (error) {}
  };

  const fetchSimilarProducts = async (categoryId, currentProductId) => {
    if (!categoryId) return;
    try {
      const { data } = await api.products.getAll({ category_id: categoryId, is_active: true });
      setSimilarProducts(data.filter(p => p.id !== currentProductId).slice(0, 8));
    } catch (error) {}
  };

  const fetchWishlist = async () => {
    try {
      const { data } = await api.wishlist.get();
      const ids = data.products?.map(p => p.id) || [];
      setWishlistIds(ids);
      setIsInWishlist(ids.includes(id));
    } catch (error) {}
  };

  // Get the effective price based on variant selection
  // When shop sale is active, always compute discount from variant's original price
  const getEffectivePrice = () => {
    if (product?.shop_sale_discount) {
      const factor = 1 - (product.shop_sale_discount / 100);
      if (selectedColor?.price) return Math.round(selectedColor.price * factor * 100) / 100;
      if (selectedSize?.price) return Math.round(selectedSize.price * factor * 100) / 100;
      if (selectedShape?.price) return Math.round(selectedShape.price * factor * 100) / 100;
      return product?.discount_price || product?.price;
    }
    if (selectedColor?.price) return selectedColor.discount_price || selectedColor.price;
    if (selectedSize?.price) return selectedSize.discount_price || selectedSize.price;
    if (selectedShape?.price) return selectedShape.discount_price || selectedShape.price;
    return product?.discount_price || product?.price;
  };

  const getEffectiveOriginalPrice = () => {
    if (selectedColor?.price) return selectedColor.price;
    if (selectedSize?.price) return selectedSize.price;
    if (selectedShape?.price) return selectedShape.price;
    return product?.price;
  };

  const getEffectiveDiscount = () => {
    if (product?.shop_sale_discount) {
      const factor = 1 - (product.shop_sale_discount / 100);
      if (selectedColor?.price) return Math.round(selectedColor.price * factor * 100) / 100;
      if (selectedSize?.price) return Math.round(selectedSize.price * factor * 100) / 100;
      if (selectedShape?.price) return Math.round(selectedShape.price * factor * 100) / 100;
      return product?.discount_price;
    }
    if (selectedColor?.discount_price) return selectedColor.discount_price;
    if (selectedSize?.discount_price) return selectedSize.discount_price;
    if (selectedShape?.discount_price) return selectedShape.discount_price;
    return product?.discount_price;
  };

  const getEffectiveStock = () => {
    if (selectedColor) return selectedColor.stock || 0;
    if (selectedSize) return selectedSize.stock || 0;
    if (selectedShape) return selectedShape.stock || 0;
    return product?.stock || 0;
  };

  const hasVariants = product?.has_color_variants || product?.has_size_variants || product?.has_shape_variants || (product?.colors?.length > 0);

  const handleAddToCart = async () => {
    const variantTypesAvailable = [];
    if ((product.has_color_variants && product.colors?.length > 0) || (!product.has_color_variants && product.colors?.length > 0)) variantTypesAvailable.push('color');
    if (product.has_size_variants && product.sizes?.length > 0) variantTypesAvailable.push('size');
    if (product.has_shape_variants && product.shapes?.length > 0) variantTypesAvailable.push('shape');

    const selectionMode = product.variant_selection_mode || 'single';

    if (variantTypesAvailable.length > 0) {
      if (selectionMode === 'multi') {
        // Multi mode (clothes): must select ALL available variant types
        const missing = [];
        if (variantTypesAvailable.includes('color') && !selectedColor) missing.push('color');
        if (variantTypesAvailable.includes('size') && !selectedSize) missing.push('size');
        if (variantTypesAvailable.includes('shape') && !selectedShape) missing.push('shape');
        if (missing.length > 0) {
          toast.error(`Please select: ${missing.join(' and ')}`);
          return;
        }
      } else {
        // Single mode: need at least one selection
        const hasAtLeastOneSelection = !!selectedColor || !!selectedSize || !!selectedShape;
        if (!hasAtLeastOneSelection) {
          toast.error(`Please select at least one: ${variantTypesAvailable.join(' / ')}`);
          return;
        }
      }
    }

    const stock = getEffectiveStock();
    if (quantity > stock) {
      toast.error(`Only ${stock} available in stock`); return;
    }
    try {
      await api.cart.add({ 
        product_id: product.id, 
        quantity, 
        selected_color: selectedColor?.color_name || null,
        selected_size: selectedSize?.size_name || null,
        selected_shape: selectedShape?.shape_name || null
      });
      toast.success('Added to cart!');
      window.dispatchEvent(new Event('cart-updated'));
    } catch (error) {
      if (error.response?.data?.detail) toast.error(error.response.data.detail);
      else toast.error('Failed to add to cart');
    }
  };

  const handleToggleWishlist = async () => {
    try {
      if (isInWishlist) { await api.wishlist.remove(product.id); setIsInWishlist(false); toast.success('Removed from wishlist'); }
      else { await api.wishlist.add(product.id); setIsInWishlist(true); toast.success('Added to wishlist!'); }
    } catch (error) { toast.error('Failed to update wishlist'); }
  };

  const handleBuyNow = async () => {
    const variantTypesAvailable = [];
    if (product.colors?.length > 0) variantTypesAvailable.push('color');
    if (product.has_size_variants && product.sizes?.length > 0) variantTypesAvailable.push('size');
    if (product.has_shape_variants && product.shapes?.length > 0) variantTypesAvailable.push('shape');
    if (variantTypesAvailable.length > 0) {
      const hasAtLeastOneSelection = !!selectedColor || !!selectedSize || !!selectedShape;
      if (!hasAtLeastOneSelection) { toast.error(`Please select at least one: ${variantTypesAvailable.join(' / ')}`); return; }
    }
    try {
      await api.cart.add({ 
        product_id: product.id, quantity, 
        selected_color: selectedColor?.color_name || null,
        selected_size: selectedSize?.size_name || null,
        selected_shape: selectedShape?.shape_name || null
      });
      window.dispatchEvent(new Event('cart-updated'));
      navigate('/checkout');
    } catch (error) { toast.error('Failed to proceed'); }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) { toast.error('Please login to submit a review'); navigate('/auth'); return; }
    if (!newReview.comment.trim()) { toast.error('Please write a comment'); return; }
    setSubmittingReview(true);
    try {
      await api.reviews.create(id, { rating: newReview.rating, title: newReview.title || null, comment: newReview.comment });
      toast.success('Review submitted successfully!');
      setNewReview({ rating: 5, title: '', comment: '' });
      setShowReviewForm(false);
      fetchReviews();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to submit review'); }
    finally { setSubmittingReview(false); }
  };

  const handleMarkHelpful = async (reviewId) => {
    try { await api.reviews.markHelpful(reviewId); fetchReviews(); } catch (error) {}
  };

  const handleMessageShopClick = () => {
    if (!user) { setLoginPromptOpen(true); return; }
    setMessageDialogOpen(true);
  };

  const handleLoginRedirect = () => {
    localStorage.setItem('post_login_redirect', location.pathname);
    setLoginPromptOpen(false);
    navigate('/auth');
  };

  // Build all images including variant images
  const getAllImages = () => {
    if (!product) return ['/placeholder.png'];
    const baseImages = product.images?.length > 0 ? product.images : [];
    const colorImages = product.colors?.map(c => c.image_url).filter(Boolean) || [];
    const shapeImages = product.shapes?.map(s => s.image_url).filter(Boolean) || [];
    const sizeImage = product.size_variant_image ? [product.size_variant_image] : [];
    const sizeImages = (!product.use_same_photo_sizes && product.sizes) ? product.sizes.map(s => s.image_url).filter(Boolean) : [];
    const allImages = [...new Set([...baseImages, ...colorImages, ...shapeImages, ...sizeImage, ...sizeImages])];
    return allImages.length > 0 ? allImages : ['/placeholder.png'];
  };

  const images = getAllImages();
  const currentImage = images[currentImageIndex] || images[0];
  const hasMultipleImages = images.length > 1;

  const animateToImage = (newIndex) => {
    if (newIndex === currentImageIndex || newIndex < 0 || newIndex >= images.length) return;
    setCurrentImageIndex(newIndex);
  };

  const nextImage = () => animateToImage((currentImageIndex + 1) % images.length);
  const prevImage = () => animateToImage((currentImageIndex - 1 + images.length) % images.length);
  const goToImage = (index) => animateToImage(index);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsDragging(true);
  };
  const onTouchMove = (e) => {
    const current = e.targetTouches[0].clientX;
    setTouchEnd(current);
    if (touchStart != null) setDragOffset(current - touchStart);
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    setDragOffset(0);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance && hasMultipleImages) nextImage();
    if (distance < -minSwipeDistance && hasMultipleImages) prevImage();
  };

  const lightboxNext = () => setLightboxIndex((prev) => (prev + 1) % images.length);
  const lightboxPrev = () => setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);

  const handleSendMessageToShop = async () => {
    if (!user) { toast.error('Please login to send messages'); navigate('/auth'); return; }
    if (!messageToShop.trim()) { toast.error('Message cannot be empty'); return; }
    try {
      await api.messages.send({ recipient_id: product.shop_id, recipient_type: 'shop', message: `Regarding product: ${product.name}\n\n${messageToShop}` });
      setMessageDialogOpen(false);
      setMessageToShop('');
      toast.success('Message sent to shop!');
    } catch (error) { toast.error('Failed to send message'); }
  };

  const StarRating = ({ rating, size = 'sm', interactive = false, onChange }) => {
    const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-6 w-6';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type={interactive ? 'button' : undefined} onClick={interactive ? () => onChange(star) : undefined}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} disabled={!interactive}>
            <Star className={`${sizeClass} ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /></div>;
  if (!product) return null;

  const effectivePrice = getEffectivePrice();
  const effectiveOriginal = getEffectiveOriginalPrice();
  const effectiveDiscount = getEffectiveDiscount();
  const hasDiscountDisplay = effectiveDiscount && effectiveDiscount < effectiveOriginal;
  const stock = getEffectiveStock();

  return (
    <div className="min-h-screen pb-20 sm:pb-12" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-0 sm:px-4 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 sm:gap-6 lg:gap-10">
          {/* Image Gallery */}
          <div className="space-y-2 sm:space-y-3" data-testid="product-images">
            <div 
              className="relative aspect-square sm:rounded-2xl overflow-hidden shadow-lg bg-slate-100 cursor-zoom-in group select-none"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onClick={() => { setLightboxIndex(currentImageIndex); setLightboxOpen(true); }}
            >
              {/* Sliding image strip */}
              <div
                className={`flex h-full w-full ${isDragging ? '' : 'transition-transform duration-500 ease-out'}`}
                style={{
                  transform: `translateX(calc(${-currentImageIndex * 100}% + ${dragOffset}px))`,
                  willChange: 'transform'
                }}
              >
                {images.map((src, idx) => (
                  <div key={idx} className="shrink-0 w-full h-full relative">
                    <img
                      src={src}
                      alt={`${product.name} - Image ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      draggable={false}
                      data-testid={idx === currentImageIndex ? 'main-product-image' : undefined}
                    />
                  </div>
                ))}
              </div>
              
              <div className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-2 opacity-0 group-hover:opacity-60 transition-opacity">
                <ZoomIn className="h-4 w-4" />
              </div>
              
              {hasMultipleImages && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all opacity-60 group-hover:opacity-100 hover:scale-110"
                    data-testid="prev-image-btn">
                    <ChevronLeft className="h-5 w-5 text-slate-700" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all opacity-60 group-hover:opacity-100 hover:scale-110"
                    data-testid="next-image-btn">
                    <ChevronRight className="h-5 w-5 text-slate-700" />
                  </button>
                </>
              )}
              {hasMultipleImages && (
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-medium">
                  {currentImageIndex + 1} / {images.length}
                </div>
              )}
              {hasMultipleImages && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
                  {images.map((_, index) => (
                    <button key={index} onClick={(e) => { e.stopPropagation(); goToImage(index); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${index === currentImageIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/75 w-1.5'}`}
                      data-testid={`dot-indicator-${index}`} />
                  ))}
                </div>
              )}
            </div>

            {/* Thumbnails - horizontal scroll */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-3 sm:px-0" data-testid="image-thumbnails">
                {images.map((img, index) => (
                  <button key={index} onClick={() => goToImage(index)}
                    className={`flex-shrink-0 w-14 h-14 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentImageIndex ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-slate-300'
                    }`} data-testid={`thumbnail-${index}`}>
                    <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-4 sm:space-y-5 px-3 sm:px-0 pt-3 sm:pt-0" data-testid="product-details">
            <div>
              {product.shop_name && product.shop_id && (
                <Link to={`/shop/${product.shop_id}`}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 mb-2 bg-emerald-50 px-2.5 sm:px-3 py-1 rounded-full" data-testid="product-shop-link">
                  <Store className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hover:underline font-medium">{product.shop_name}</span>
                </Link>
              )}
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2 sm:mb-3" data-testid="product-detail-name">{product.name}</h1>
              
              {reviewStats.total > 0 && (
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <StarRating rating={Math.round(reviewStats.average)} size="sm" />
                  <span className="text-xs sm:text-sm text-slate-600">{reviewStats.average.toFixed(1)} ({reviewStats.total} reviews)</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900" data-testid="product-detail-price">${effectivePrice?.toFixed(2)}</span>
                {hasDiscountDisplay && <span className="text-base sm:text-lg text-slate-400 line-through">${effectiveOriginal?.toFixed(2)}</span>}
                {product.shop_sale_discount ? (
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1" data-testid="product-detail-sale-badge">
                    {product.shop_sale_title || `${product.shop_sale_discount}% OFF Sale`}
                  </span>
                ) : hasDiscountDisplay ? (
                  <span className="bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-sm">
                    {Math.round(((effectiveOriginal - effectiveDiscount) / effectiveOriginal) * 100)}% OFF
                  </span>
                ) : null}
              </div>
            </div>

            {/* Description */}
            <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4">
              <h2 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2 flex items-center gap-2 text-slate-800">
                <Package className="h-4 w-4 text-slate-400" />
                {t('product.description')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed" data-testid="product-detail-description">{product.description}</p>
            </div>

            {/* Color Variants */}
            {((product.has_color_variants && product.colors?.length > 0) || (!product.has_color_variants && product.colors?.length > 0)) && (
              <div data-testid="color-selection">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="h-4 w-4 text-violet-500" />
                  <p className="text-sm font-medium text-slate-700">
                    Color: {selectedColor ? (
                      <span className="font-semibold text-slate-800">{selectedColor.color_name}
                        {selectedColor.stock !== undefined && <span className="text-slate-500 font-normal ml-1">({selectedColor.stock} in stock)</span>}
                      </span>
                    ) : <span className="text-rose-500">Select a color *</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color, index) => {
                    const isOutOfStock = color.stock === 0;
                    const isSelected = selectedColor?.color_name === color.color_name;
                    return (
                      <button key={index} onClick={() => !isOutOfStock && handleColorSelect(color)} disabled={isOutOfStock}
                        className={`relative group transition-all rounded-xl overflow-hidden ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : isSelected ? 'ring-2 ring-violet-500 ring-offset-2' : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'}`}
                        title={`${color.color_name}${isOutOfStock ? ' (Out of stock)' : ''}`} data-testid={`color-option-${index}`}>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 overflow-hidden">
                          {color.image_url ? <img src={color.image_url} alt={color.color_name} className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale' : ''}`} /> :
                            <div className={`w-full h-full ${isOutOfStock ? 'opacity-50' : ''}`} style={{ backgroundColor: color.color_code || '#ccc' }} />}
                        </div>
                        {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="text-[8px] text-white font-bold">SOLD OUT</span></div>}
                        <div className="text-center py-0.5 bg-white border-t">
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-violet-700' : 'text-slate-600'}`}>{color.color_name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Variants */}
            {product.has_size_variants && product.sizes?.length > 0 && (
              <div data-testid="size-selection">
                <div className="flex items-center gap-2 mb-2">
                  <Ruler className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-medium text-slate-700">
                    Size: {selectedSize ? (
                      <span className="font-semibold text-slate-800">{selectedSize.size_name}
                        <span className="text-slate-500 font-normal ml-1">({selectedSize.stock} in stock)</span>
                      </span>
                    ) : <span className="text-rose-500">Select a size *</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size, index) => {
                    const isOutOfStock = size.stock === 0;
                    const isSelected = selectedSize?.size_name === size.size_name;
                    return (
                      <button key={index} onClick={() => !isOutOfStock && handleSizeSelect(size)} disabled={isOutOfStock}
                        className={`min-w-[3rem] px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                          isOutOfStock ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400 line-through' 
                          : isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                          : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                        }`} data-testid={`size-option-${index}`}>
                        {size.size_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shape Variants */}
            {product.has_shape_variants && product.shapes?.length > 0 && (
              <div data-testid="shape-selection">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-medium text-slate-700">
                    Shape: {selectedShape ? (
                      <span className="font-semibold text-slate-800">{selectedShape.shape_name}
                        <span className="text-slate-500 font-normal ml-1">({selectedShape.stock} in stock)</span>
                      </span>
                    ) : <span className="text-rose-500">Select a shape *</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.shapes.map((shape, index) => {
                    const isOutOfStock = shape.stock === 0;
                    const isSelected = selectedShape?.shape_name === shape.shape_name;
                    return (
                      <button key={index} onClick={() => !isOutOfStock && handleShapeSelect(shape)} disabled={isOutOfStock}
                        className={`relative group transition-all rounded-xl overflow-hidden ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : isSelected ? 'ring-2 ring-emerald-500 ring-offset-2' : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'}`}
                        data-testid={`shape-option-${index}`}>
                        <div className="w-14 h-14 sm:w-16 sm:h-16 overflow-hidden">
                          {shape.image_url ? <img src={shape.image_url} alt={shape.shape_name} className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale' : ''}`} /> :
                            <div className="w-full h-full bg-slate-200 flex items-center justify-center"><Box className="h-6 w-6 text-slate-400" /></div>}
                        </div>
                        {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="text-[8px] text-white font-bold">SOLD OUT</span></div>}
                        <div className="text-center py-0.5 bg-white border-t">
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>{shape.shape_name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Availability */}
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500">Availability:</p>
              {stock > 0 ? (
                <p className="text-emerald-600 font-bold text-sm flex items-center gap-1" data-testid="stock-status">
                  <CheckCircle className="h-3.5 w-3.5" /> In Stock ({stock} available)
                </p>
              ) : (<p className="text-red-500 font-semibold text-sm" data-testid="out-of-stock-status">Out of Stock</p>)}
            </div>

            {/* Free Gift Banner */}
            {product.has_free_gift && (
              <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-amber-50 rounded-xl p-4 border border-pink-200 shadow-sm" data-testid="product-gift-banner">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-md">
                    <Gift className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-pink-800 text-sm">Mystery Gift Included!</p>
                    <p className="text-xs text-pink-600">This product has a mystery gift attached to it. You'll discover what it is when you purchase!</p>
                  </div>
                </div>
              </div>
            )}

            {stock > 0 && (
              <div>
                <p className="text-xs text-slate-600 mb-2">{t('product.quantity')}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-200 rounded-full">
                    <Button variant="ghost" size="sm" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} className="rounded-full h-8 w-8 p-0" data-testid="decrease-quantity"><Minus className="h-3 w-3" /></Button>
                    <span className="px-4 font-semibold text-sm" data-testid="quantity-value">{quantity}</span>
                    <Button variant="ghost" size="sm" onClick={() => setQuantity(Math.min(stock, quantity + 1))} disabled={quantity >= stock} className="rounded-full h-8 w-8 p-0" data-testid="increase-quantity"><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop action buttons */}
            <div className="hidden sm:flex gap-3">
              <Button onClick={handleAddToCart} disabled={stock === 0}
                className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 h-10 text-sm" data-testid="add-to-cart-detail-button">
                <ShoppingCart className="mr-2 h-4 w-4" /> {t('product.addToCart')}
              </Button>
              <Button onClick={handleToggleWishlist} variant="outline" className={`rounded-full h-10 w-10 p-0 ${isInWishlist ? 'bg-red-50 border-red-200' : ''}`} data-testid="wishlist-detail-button">
                <Heart className={`h-4 w-4 ${isInWishlist ? 'text-red-500 fill-red-500' : ''}`} />
              </Button>
              <Button onClick={() => {
                const url = window.location.href;
                if (navigator.share) { navigator.share({ title: product.name, text: product.description, url }).catch(() => {}); }
                else { try { navigator.clipboard.writeText(url).then(() => toast.success(t('product.linkCopied'))); } catch { toast.info(`Share: ${url}`); } }
              }} variant="outline" className="rounded-full h-10 w-10 p-0" data-testid="share-detail-button">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile: compact inline buttons for wishlist/share */}
            <div className="flex sm:hidden gap-2">
              <Button onClick={handleToggleWishlist} variant="outline" size="sm" className={`rounded-full flex-1 h-9 text-xs ${isInWishlist ? 'bg-red-50 border-red-200 text-red-600' : ''}`} data-testid="wishlist-detail-button-mobile">
                <Heart className={`h-3.5 w-3.5 mr-1.5 ${isInWishlist ? 'text-red-500 fill-red-500' : ''}`} />
                {isInWishlist ? 'Saved' : 'Wishlist'}
              </Button>
              <Button onClick={() => {
                const url = window.location.href;
                if (navigator.share) { navigator.share({ title: product.name, text: product.description, url }).catch(() => {}); }
                else { try { navigator.clipboard.writeText(url).then(() => toast.success(t('product.linkCopied'))); } catch { toast.info(`Share: ${url}`); } }
              }} variant="outline" size="sm" className="rounded-full flex-1 h-9 text-xs" data-testid="share-detail-button-mobile">
                <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
              </Button>
            </div>

            <Button onClick={handleBuyNow} disabled={stock === 0} variant="outline" className="w-full rounded-full h-10 text-sm hidden sm:flex" data-testid="buy-now-button">{t('product.buyNow') || 'Buy Now'}</Button>

            <Button onClick={handleMessageShopClick} variant="outline"
              className="w-full rounded-full h-10 text-sm border-emerald-200 text-emerald-600 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 transition-all duration-200"
              data-testid="message-shop-button">
              <MessageSquare className="mr-2 h-4 w-4" /> {t('product.messageShop')}
            </Button>

            {/* Login Prompt Dialog */}
            <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-center">Login Required</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                    <LogIn className="h-8 w-8 text-violet-600" />
                  </div>
                  <p className="text-center text-slate-600 text-sm">You need to login to message the shop.</p>
                  <Button onClick={handleLoginRedirect} className="w-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600">
                    <LogIn className="mr-2 h-4 w-4" /> Login
                  </Button>
                  <Button variant="ghost" onClick={() => setLoginPromptOpen(false)} className="text-slate-500 text-sm">Cancel</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Message Shop</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600"><strong>Product:</strong> {product.name}</p>
                    <p className="text-sm text-slate-600 mt-1"><strong>Shop:</strong> {product.shop_name || 'Shop'}</p>
                  </div>
                  <div>
                    <Label htmlFor="message-to-shop">Your Message</Label>
                    <Textarea id="message-to-shop" value={messageToShop} onChange={(e) => setMessageToShop(e.target.value)} placeholder="Ask about product details, availability..." rows={5} />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={handleSendMessageToShop} className="flex-1"><Send className="h-4 w-4 mr-2" /> Send Message</Button>
                    <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Sponsored — You may also like (category-targeted, excludes this product & shop) */}
        <div className="mt-8 sm:mt-12 px-3 sm:px-0">
          <SponsoredRow
            surface="product_detail"
            title="Sponsored — You may also like"
            subtitle="Promoted products picked for you"
            categoryId={product.category_id || product.category_ids?.[0]}
            excludeProductIds={[product.id]}
            excludeShopId={product.shop_id}
            variant="carousel"
            limit={10}
            data-testid="sponsored-you-may-like"
          />
        </div>

        {/* Reviews Section */}
        <div className="mt-8 sm:mt-14 px-3 sm:px-0" data-testid="reviews-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" /> Reviews
            </h2>
            {user && user.shop_id !== product.shop_id && (
              <Button onClick={() => setShowReviewForm(!showReviewForm)} variant={showReviewForm ? 'outline' : 'default'} className="rounded-full" data-testid="write-review-btn">
                {showReviewForm ? 'Cancel' : 'Write a Review'}
              </Button>
            )}
            {user && user.shop_id === product.shop_id && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold" data-testid="own-shop-review-disabled">
                <Store className="h-3.5 w-3.5" /> You can't rate your own products
              </span>
            )}
          </div>
          {showReviewForm && (
            <div className="bg-white rounded-xl p-6 shadow-card mb-6" data-testid="review-form">
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div><Label>Your Rating *</Label><div className="mt-2"><StarRating rating={newReview.rating} size="lg" interactive={true} onChange={(rating) => setNewReview({ ...newReview, rating })} /></div></div>
                <div><Label htmlFor="review-title">Title (Optional)</Label><Input id="review-title" value={newReview.title} onChange={(e) => setNewReview({ ...newReview, title: e.target.value })} placeholder="Summarize your experience" className="mt-1" /></div>
                <div><Label htmlFor="review-comment">Your Review *</Label><Textarea id="review-comment" value={newReview.comment} onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} placeholder="Share your thoughts..." rows={4} className="mt-1" required /></div>
                <Button type="submit" disabled={submittingReview} className="bg-gradient-to-r from-violet-600 to-indigo-600">{submittingReview ? 'Submitting...' : 'Submit Review'}</Button>
              </form>
            </div>
          )}
          {reviewStats.total > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-card mb-6">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="text-center sm:border-r sm:pr-6">
                  <div className="text-4xl font-bold text-slate-900">{reviewStats.average.toFixed(1)}</div>
                  <StarRating rating={Math.round(reviewStats.average)} size="md" />
                  <p className="text-sm text-slate-500 mt-1">{reviewStats.total} reviews</p>
                </div>
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviewStats.distribution[star] || 0;
                    const percentage = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-sm w-3">{star}</span>
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${percentage}%` }} /></div>
                        <span className="text-xs text-slate-500 w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-xl p-5 shadow-card" data-testid={`review-${review.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-violet-100 rounded-full p-2"><User className="h-5 w-5 text-violet-600" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{review.user_name}</span>
                          {review.is_verified_purchase && <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle className="h-3 w-3" /> Verified Purchase</span>}
                        </div>
                        <p className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    </div>
                    <StarRating rating={review.rating} size="sm" />
                  </div>
                  {review.title && <h4 className="font-semibold mb-2">{review.title}</h4>}
                  <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>
                  <div className="mt-3 pt-3 border-t flex items-center gap-4">
                    <button onClick={() => handleMarkHelpful(review.id)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 transition-colors">
                      <ThumbsUp className="h-3 w-3" /> Helpful ({review.helpful_count || 0})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 shadow-card text-center">
              <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700 mb-1">No Reviews Yet</h3>
              <p className="text-slate-500 text-sm">Be the first to review this product!</p>
              {!user && <Link to="/auth" className="text-violet-600 text-sm hover:underline mt-2 inline-block">Login to write a review</Link>}
            </div>
          )}
        </div>
      </div>

      {/* Promoted from this category — strip near related products */}
      <div className="mt-10 sm:mt-14">
        <div className="max-w-screen-2xl mx-auto px-0 sm:px-5 lg:px-8">
          <SponsoredRow
            surface="product_detail"
            title={`Promoted from this category`}
            subtitle="Sponsored items related to what you're viewing"
            categoryId={product.category_id || product.category_ids?.[0]}
            excludeProductIds={[product.id]}
            excludeShopId={product.shop_id}
            variant="grid"
            limit={10}
            data-testid="sponsored-promoted-category"
          />
        </div>
      </div>

      {/* Similar Products - WIDE */}
      {similarProducts.length > 0 && (
        <div className="mt-10 sm:mt-14">
          <div className="max-w-screen-2xl mx-auto px-0 sm:px-5 lg:px-8">
            <h2 className="text-xl sm:text-2xl font-heading font-bold mb-4 sm:mb-6 px-3 sm:px-0">{t('product.similarProducts')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0 sm:gap-3" data-testid="similar-products">
              {similarProducts.map((p) => (
                <ProductCard key={p.id} product={p} wishlistIds={wishlistIds} showShopName={true} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations - Customers Also Bought - WIDE */}
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-5 lg:px-8">
        <ProductRecommendations productId={id} title={t('product.customersAlsoBought')} showShopName={true} />
      </div>

      {/* Image Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" data-testid="image-lightbox"
          onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
            onClick={() => setLightboxOpen(false)}><X className="h-6 w-6" /></button>
          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <img src={images[lightboxIndex]} alt={`${product.name} - Full view`} className="max-w-full max-h-full object-contain rounded-lg" />
            {hasMultipleImages && (
              <>
                <button onClick={lightboxPrev} className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 rounded-full p-3 text-white transition-all"><ChevronLeft className="h-6 w-6" /></button>
                <button onClick={lightboxNext} className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 rounded-full p-3 text-white transition-all"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button key={index} onClick={() => setLightboxIndex(index)} className={`w-2.5 h-2.5 rounded-full transition-all ${index === lightboxIndex ? 'bg-white w-5' : 'bg-white/40 hover:bg-white/60'}`} />
              ))}
            </div>
            <div className="absolute bottom-4 right-4 text-white/60 text-sm">{lightboxIndex + 1} / {images.length}</div>
          </div>
        </div>
      )}

      {/* Sticky Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200 px-3 py-2.5 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]" data-testid="mobile-sticky-bar">
        <div className="flex items-center gap-2.5">
          <div className="flex-shrink-0">
            <p className="text-lg font-extrabold text-slate-900">${effectivePrice?.toFixed(2)}</p>
            {hasDiscountDisplay && <p className="text-[10px] text-slate-400 line-through">${effectiveOriginal?.toFixed(2)}</p>}
          </div>
          <Button onClick={handleAddToCart} disabled={stock === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 h-11 text-sm font-bold shadow-lg shadow-violet-500/20" data-testid="mobile-add-to-cart-btn">
            <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
          </Button>
          <Button onClick={handleBuyNow} disabled={stock === 0} className="rounded-xl h-11 px-4 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white" data-testid="mobile-buy-now-btn">
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
