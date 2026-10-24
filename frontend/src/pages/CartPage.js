import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, Plus, Minus, Store, Gift, Sparkles, ShoppingBag, ArrowRight, Shield, Truck, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/i18n';
import { AuthContext } from '../App';
import SponsoredRow from '../components/SponsoredRow';
import RecommendedProductsSection from '../components/RecommendedProductsSection';

const CartPage = () => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [firstPurchaseBonus, setFirstPurchaseBonus] = useState(null);
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    fetchCart();
    if (user) { checkFirstPurchaseBonus(); fetchLoyalty(); }
    const handleCartUpdated = () => fetchCart();
    window.addEventListener('cart-updated', handleCartUpdated);
    return () => window.removeEventListener('cart-updated', handleCartUpdated);
  }, [user]);

  const fetchLoyalty = async () => {
    try {
      const { data } = await api.loyalty.getStatus();
      if (data && data.enabled) setLoyalty(data);
    } catch (e) { /* silent */ }
  };

  const checkFirstPurchaseBonus = async () => {
    try {
      const [ordersRes, settingsRes] = await Promise.allSettled([
        api.orders.getAll(),
        api.admin.getPlatformSettings()
      ]);
      const orders = ordersRes.status === 'fulfilled' ? ordersRes.value.data : [];
      const settings = settingsRes.status === 'fulfilled' ? settingsRes.value.data : {};
      if (orders.length === 0 && settings.first_purchase_bonus_enabled) {
        setFirstPurchaseBonus(settings.first_purchase_bonus_points || 100);
      }
    } catch (e) { /* silent */ }
  };

  const fetchCart = async () => {
    try {
      const { data } = await api.cart.get();
      setCart(data);
    } catch (error) {
      console.error('Failed to fetch cart', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId, newQuantity) => {
    try {
      await api.cart.update({ product_id: productId, quantity: newQuantity });
      fetchCart();
      window.dispatchEvent(new Event('cart-updated'));
      toast.success('Cart updated');
    } catch (error) {
      toast.error('Failed to update cart');
    }
  };

  const removeItem = async (productId) => {
    try {
      await api.cart.remove(productId);
      fetchCart();
      window.dispatchEvent(new Event('cart-updated'));
      toast.success('Item removed');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const total = cart.items.reduce((sum, item) => {
    const colorV = item.selected_color && item.product.colors ? item.product.colors.find(c => c.color_name === item.selected_color) : null;
    const sizeV = item.selected_size && item.product.sizes ? item.product.sizes.find(s => s.size_name === item.selected_size) : null;
    const shapeV = item.selected_shape && item.product.shapes ? item.product.shapes.find(s => s.shape_name === item.selected_shape) : null;
    const vPrice = colorV?.discount_price || colorV?.price || sizeV?.discount_price || sizeV?.price || shapeV?.discount_price || shapeV?.price || null;
    const price = vPrice || item.product.discount_price || item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const totalWithoutDiscount = cart.items.reduce((sum, item) => {
    const colorV = item.selected_color && item.product.colors ? item.product.colors.find(c => c.color_name === item.selected_color) : null;
    const sizeV = item.selected_size && item.product.sizes ? item.product.sizes.find(s => s.size_name === item.selected_size) : null;
    const shapeV = item.selected_shape && item.product.shapes ? item.product.shapes.find(s => s.shape_name === item.selected_shape) : null;
    const vPrice = colorV?.price || sizeV?.price || shapeV?.price || null;
    return sum + (vPrice || item.product.price) * item.quantity;
  }, 0);

  const totalSavings = totalWithoutDiscount - total;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Loading your cart...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-4 pb-8 sm:pt-6 sm:pb-12 overflow-x-clip" data-testid="cart-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-violet-600 hover:border-violet-300 transition-all shadow-sm" data-testid="cart-back-btn">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="cart-page-title">{t('cart.title')}</h1>
              {cart.items.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{cart.items.length} item{cart.items.length !== 1 ? 's' : ''} in your cart</p>
              )}
            </div>
          </div>
          {cart.items.length > 0 && (
            <Link to="/products" className="hidden sm:flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-semibold group" data-testid="continue-shopping-link">
              Continue Shopping <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}
        </div>

        {cart.items.length === 0 ? (
          <div className="text-center py-16 sm:py-20" data-testid="empty-cart">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
              <ShoppingBag className="h-9 w-9 text-violet-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Your cart is empty</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">{t('cart.empty') || "Looks like you haven't added anything to your cart yet."}</p>
            <Button
              onClick={() => navigate('/products')}
              className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-sm px-8 h-11 shadow-lg shadow-violet-500/20"
              data-testid="continue-shopping-button"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              {t('cart.continueShopping') || 'Start Shopping'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-3" data-testid="cart-items">
              {cart.items.map((item, itemIndex) => {
                const price = item.product.discount_price || item.product.price;
                const hasDiscount = item.product.discount_price && item.product.discount_price < item.product.price;
                const discountPercent = hasDiscount ? Math.round(((item.product.price - item.product.discount_price) / item.product.price) * 100) : 0;
                
                const selectedColor = item.selected_color;
                const selectedSize = item.selected_size;
                const selectedShape = item.selected_shape;
                const colorVariant = selectedColor && item.product.colors ? item.product.colors.find(c => c.color_name === selectedColor) : null;
                const sizeVariant = selectedSize && item.product.sizes ? item.product.sizes.find(s => s.size_name === selectedSize) : null;
                const shapeVariant = selectedShape && item.product.shapes ? item.product.shapes.find(s => s.shape_name === selectedShape) : null;
                
                const displayImage = colorVariant?.image_url || shapeVariant?.image_url || sizeVariant?.image_url || item.product.images?.[0] || '/placeholder.png';
                const variantPrice = colorVariant?.discount_price || colorVariant?.price || sizeVariant?.discount_price || sizeVariant?.price || shapeVariant?.discount_price || shapeVariant?.price || null;
                const effectivePrice = variantPrice || price;
                const variantOrigPrice = colorVariant?.price || sizeVariant?.price || shapeVariant?.price || null;
                const effectiveOrigPrice = variantOrigPrice || item.product.price;
                const effectiveHasDiscount = (colorVariant?.discount_price && colorVariant.discount_price < colorVariant.price) || 
                  (sizeVariant?.discount_price && sizeVariant.discount_price < sizeVariant.price) ||
                  (shapeVariant?.discount_price && shapeVariant.discount_price < shapeVariant.price) || hasDiscount;
                const effectiveDiscountPct = effectiveHasDiscount ? Math.round(((effectiveOrigPrice - effectivePrice) / effectiveOrigPrice) * 100) : 0;
                const variantLabels = [selectedColor && `Color: ${selectedColor}`, selectedSize && `Size: ${selectedSize}`, selectedShape && `Shape: ${selectedShape}`].filter(Boolean);
                
                return (
                  <div
                    key={`${item.product.id}-${selectedColor || 'default'}`}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-200"
                    style={{ animationDelay: `${itemIndex * 50}ms` }}
                    data-testid={`cart-item-${item.product.id}`}
                  >
                    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
                      {/* Product Image */}
                      <Link to={`/products/${item.product.id}`} className="relative flex-shrink-0 group">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100">
                          <img
                            src={displayImage}
                            alt={item.product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            data-testid="cart-item-image"
                          />
                        </div>
                        {effectiveHasDiscount && effectiveDiscountPct > 0 && (
                          <span className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                            -{effectiveDiscountPct}%
                          </span>
                        )}
                      </Link>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <Link to={`/products/${item.product.id}`}>
                              <h3 className="font-bold text-sm sm:text-base text-slate-800 line-clamp-1 hover:text-violet-600 transition-colors" data-testid="cart-item-name">{item.product.name}</h3>
                            </Link>
                            {variantLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {variantLabels.map((label, idx) => (
                                  <span key={idx} className="text-[10px] text-violet-600 font-medium bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.product.shop_sale_discount && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200 mt-1" data-testid="cart-sale-badge">
                                {item.product.shop_sale_title || `${item.product.shop_sale_discount}% OFF Sale`}
                              </span>
                            )}
                            {item.product.shop_name && (
                              <Link to={`/shop/${item.product.shop_id}`} className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 hover:text-emerald-600 transition-colors">
                                <Store className="h-2.5 w-2.5" />
                                {item.product.shop_name}
                              </Link>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.product.id)}
                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0 flex-shrink-0 rounded-lg transition-all"
                            data-testid="remove-cart-item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Price row */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-sm font-bold text-slate-800">${effectivePrice.toFixed(2)}</span>
                          {effectiveHasDiscount && (
                            <span className="text-xs text-slate-400 line-through">${effectiveOrigPrice.toFixed(2)}</span>
                          )}
                        </div>
                        
                        {/* Quantity & Total */}
                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center bg-slate-50 rounded-full border border-slate-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="rounded-full h-8 w-8 p-0 hover:bg-slate-200 text-slate-500"
                              data-testid="decrease-cart-quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-3 font-bold text-sm text-slate-700 min-w-[28px] text-center" data-testid="cart-item-quantity">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= (colorVariant ? colorVariant.stock : sizeVariant ? sizeVariant.stock : shapeVariant ? shapeVariant.stock : item.product.stock)}
                              className="rounded-full h-8 w-8 p-0 hover:bg-slate-200 text-slate-500"
                              data-testid="increase-cart-quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-base sm:text-lg text-slate-900" data-testid="cart-item-price">${(effectivePrice * item.quantity).toFixed(2)}</p>
                            {effectiveHasDiscount && (
                              <p className="text-[10px] text-emerald-600 font-medium">Saved ${((effectiveOrigPrice - effectivePrice) * item.quantity).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Free Gift Badge */}
                        {item.has_free_gift && (
                          <div className="mt-2.5 flex items-center gap-2 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-2.5 border border-pink-200/60" data-testid="cart-gift-badge">
                            {item.gift_image && (
                              <img src={item.gift_image} alt="Gift" className="w-8 h-8 rounded-lg object-cover" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <Gift className="h-3 w-3 text-pink-500" />
                                <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wide">Free Gift Included</span>
                              </div>
                              <p className="text-[10px] text-pink-400">Mystery gift revealed after purchase!</p>
                            </div>
                            <span className="text-xs font-bold text-pink-500">$0.00</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1 lg:sticky lg:top-24 self-start" data-testid="cart-summary">
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                {/* Summary Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 sm:p-5">
                  <h2 className="font-bold text-white text-base sm:text-lg">Order Summary</h2>
                  <p className="text-violet-200 text-xs mt-0.5">{cart.items.length} item{cart.items.length !== 1 ? 's' : ''}</p>
                </div>

                <div className="p-4 sm:p-5">
                  {/* Compact item list */}
                  <div className="space-y-2.5 mb-4 max-h-56 overflow-y-auto pr-1 scrollbar-hide">
                    {cart.items.map((item) => {
                      const price = item.product.discount_price || item.product.price;
                      const selectedColor = item.selected_color;
                      const colorVariant = selectedColor && item.product.colors ? item.product.colors.find(c => c.color_name === selectedColor) : null;
                      const displayImage = colorVariant?.image_url || item.product.images?.[0] || '/placeholder.png';
                      
                      return (
                        <div key={`${item.product.id}-${selectedColor || 'default'}`} className="flex gap-2.5 items-center" data-testid="cart-summary-item">
                          <img src={displayImage} alt={item.product.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0 border border-slate-100" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{item.product.name}</p>
                            {selectedColor && <p className="text-[10px] text-violet-500">{selectedColor}</p>}
                            <p className="text-[10px] text-slate-400">x{item.quantity}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-800 flex-shrink-0">${(price * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Price breakdown */}
                  <div className="border-t border-dashed border-slate-200 pt-3 space-y-2 mb-4">
                    {totalSavings > 0 && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Original Total</span>
                          <span className="text-slate-400 line-through" data-testid="cart-total-no-discount">${totalWithoutDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-600 font-medium">You Save</span>
                          <span className="text-emerald-600 font-bold" data-testid="cart-savings">-${totalSavings.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-bold text-slate-800" data-testid="cart-subtotal">${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Delivery</span>
                      <span className="text-slate-400 italic" data-testid="cart-delivery-note">At checkout</span>
                    </div>
                  </div>

                  {/* Grand Total */}
                  <div className="bg-slate-50 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-xl font-extrabold text-violet-600" data-testid="cart-total">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Loyalty points balance (display only — redeem at checkout) */}
                  {user && loyalty && loyalty.points_balance > 0 && (
                    <div className="mt-4 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200/70" data-testid="cart-loyalty-balance">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Gift className="h-4.5 w-4.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-700">Your loyalty points</p>
                        <p className="text-sm font-bold text-amber-900">
                          {loyalty.points_balance.toLocaleString()} pts
                          {typeof loyalty.redeem_value === 'number' && (
                            <span className="font-medium text-emerald-700"> · worth ${loyalty.redeem_value.toFixed(2)}</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">Redeem at checkout</span>
                    </div>
                  )}

                  {/* First Purchase Bonus */}
                  {firstPurchaseBonus && (
                    <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200/60" data-testid="first-purchase-bonus-banner">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-amber-800">First Order Bonus!</p>
                          <p className="text-[10px] text-amber-600">Earn <strong>+{firstPurchaseBonus} bonus points</strong> on first purchase!</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checkout Button */}
                  <Button
                    onClick={() => navigate('/checkout')}
                    className="w-full mt-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-sm h-12 font-bold shadow-lg shadow-violet-500/20 transition-all hover:shadow-xl hover:shadow-violet-500/25"
                    data-testid="proceed-to-checkout-button"
                  >
                    Proceed to Checkout
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Shield className="h-3 w-3" />
                      <span className="text-[10px]">Secure</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Truck className="h-3 w-3" />
                      <span className="text-[10px]">Fast Delivery</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* "Sponsored add-ons" — laptop-only, full page width, 6 per row */}
      <div className="hidden xl:block w-full px-6 lg:px-10 mt-8">
        <SponsoredRow
          surface="cart_checkout"
          title="Sponsored add-ons"
          subtitle="Popular extras you might want"
          variant="grid"
          gridColsClass="grid-cols-6"
          limit={6}
          lowPriceFirst={true}
          excludeProductIds={cart.items.map((i) => i.product?.id).filter(Boolean)}
          data-testid="sponsored-addons-cart"
        />
      </div>

      {/* Recommended Products — laptop-only, full page width (component handles layout) */}
      <div className="pb-10">
        <RecommendedProductsSection
          title="Recommended Picks"
          excludeProductIds={cart.items.map((i) => i.product?.id).filter(Boolean)}
          categoryIds={[...new Set(cart.items.flatMap((i) => [i.product?.category_id, ...(i.product?.category_ids || [])].filter(Boolean)))]}
        />
      </div>
    </div>
  );
};

export default CartPage;
