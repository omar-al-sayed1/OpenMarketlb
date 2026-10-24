import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, Package, Truck, CheckCircle, Clock, MapPin,
  Store, AlertCircle, CreditCard, ShoppingBag, ArrowRight,
  CircleDot, Sparkles, Shield, PartyPopper, XCircle, Gift, Loader2
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import SponsoredProductsGridSection from '../components/SponsoredProductsGridSection';
import RecommendedProductsSection from '../components/RecommendedProductsSection';

const OrderTrackingPage = () => {
  const { t } = useLanguage();
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const ORDER_STATUSES = [
    { key: 'pending', label: t('orderTracking.orderPlaced'), icon: ShoppingBag, color: 'slate', description: t('orderTracking.orderPlacedDesc') },
    { key: 'confirmed', label: t('orderTracking.confirmed'), icon: Shield, color: 'blue', description: t('orderTracking.confirmedDesc') },
    { key: 'processing', label: t('orderTracking.processing'), icon: Package, color: 'indigo', description: t('orderTracking.processingDesc') },
    { key: 'paid', label: t('orderTracking.paymentVerified'), icon: CreditCard, color: 'violet', description: t('orderTracking.paymentVerifiedDesc') },
    { key: 'shipped', label: t('orderTracking.shipped'), icon: Truck, color: 'purple', description: t('orderTracking.shippedDesc') },
    { key: 'delivered', label: t('orderTracking.delivered'), icon: PartyPopper, color: 'emerald', description: t('orderTracking.deliveredDesc') || 'Order has been delivered successfully!' },
  ];

  const { orderId: paramOrderId } = useParams();
  // Auto-track when opened via /track-order/:orderId (e.g. from order history / success page)
  useEffect(() => {
    if (paramOrderId) { setOrderId(paramOrderId); handleTrack(null, paramOrderId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramOrderId]);

  const handleTrack = async (e, forcedId) => {
    if (e) e.preventDefault();
    const id = (forcedId || orderId).trim();
    if (!id) { setError('Please enter an order ID'); return; }
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const { data } = await api.orders.track(id);
      setOrder(data);
      // Fetch tracking info
      try {
        const { data: tracking } = await api.orderTracking.get(id);
        setTrackingInfo(tracking);
        // Connect WebSocket for live updates
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const backendHost = process.env.REACT_APP_BACKEND_URL?.replace(/^https?:\/\//, '') || 'localhost:8001';
        const ws = new WebSocket(`${wsProtocol}//${backendHost}/ws/tracking/${id}`);
        ws.onopen = () => setWsConnected(true);
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'location_update') {
            setTrackingInfo(prev => ({ ...prev, current_driver_location: { lat: msg.lat, lng: msg.lng } }));
          } else if (msg.type === 'status') {
            setTrackingInfo(prev => ({ ...prev, delivery_status: msg.delivery_status }));
          }
        };
        ws.onclose = () => setWsConnected(false);
      } catch {}
    } catch (err) {
      setError('Order not found. Please check your order ID and try again.');
      setOrder(null);
    } finally { setLoading(false); }
  };

  const getStatusIndex = () => {
    if (!order) return -1;
    if (order.order_status === 'cancelled') return -1;
    const statusMap = { pending: 0, confirmed: 1, processing: 2, paid: 3, shipped: 4, delivered: 5 };
    return statusMap[order?.order_status] ?? 0;
  };

  const isCancelled = order?.order_status === 'cancelled';
  const currentIndex = getStatusIndex();

  const colorMap = {
    slate: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-300', activeBg: 'bg-slate-500', gradFrom: 'from-slate-400', gradTo: 'to-slate-600' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-300', activeBg: 'bg-blue-500', gradFrom: 'from-blue-400', gradTo: 'to-blue-600' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-300', activeBg: 'bg-indigo-500', gradFrom: 'from-indigo-400', gradTo: 'to-indigo-600' },
    violet: { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-300', activeBg: 'bg-violet-500', gradFrom: 'from-violet-400', gradTo: 'to-violet-600' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-300', activeBg: 'bg-purple-500', gradFrom: 'from-purple-400', gradTo: 'to-purple-600' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-300', activeBg: 'bg-emerald-500', gradFrom: 'from-emerald-400', gradTo: 'to-emerald-600' },
    red: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-300', activeBg: 'bg-red-500', gradFrom: 'from-red-400', gradTo: 'to-red-600' },
  };

  return (
    <div className="min-h-screen" data-testid="order-tracking-page">
      {/* Hero Section with immersive background */}
      <div className="relative bg-slate-950 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
          <div className="absolute top-[-150px] left-[20%] w-[400px] h-[400px] bg-violet-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-80px] right-[10%] w-[350px] h-[350px] bg-indigo-600/15 rounded-full blur-[100px]" />
          <div className="absolute top-[30%] right-[40%] w-[200px] h-[200px] bg-pink-500/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-14 sm:pt-14 sm:pb-20 text-center">
          {/* Floating package icon */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-xl animate-pulse" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-violet-500/30" style={{ animation: 'float 4s ease-in-out infinite' }}>
              <Package className="h-10 w-10 text-white" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-3" data-testid="track-order-title">
            Track Your{' '}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Order</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto mb-8">
            Enter your order ID to see real-time status and delivery updates
          </p>

          {/* Search Form - Glass morphism */}
          <form onSubmit={handleTrack} className="relative max-w-xl mx-auto" data-testid="track-order-form">
            <div className={`relative flex items-center bg-white/[0.06] backdrop-blur-xl border rounded-2xl transition-all duration-300 ${
              orderId ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.1)]' : 'border-white/10'
            }`}>
              <div className="ml-4">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <Input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Enter Order ID..."
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 border-0 py-4 px-3 text-sm sm:text-base outline-none shadow-none focus-visible:ring-0"
                data-testid="order-id-input"
              />
              <Button
                type="submit"
                disabled={loading}
                className="m-1.5 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
                data-testid="track-order-button"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span className="sm:hidden">Track</span>
                    <span className="hidden sm:inline">{t('orderTracking.track')}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Curved transition */}
        <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-14">
          <svg viewBox="0 0 1440 96" className="w-full h-full" preserveAspectRatio="none">
            <path d="M0 96L1440 96L1440 0C1200 80 720 96 360 80C180 72 60 48 0 0L0 96Z" className="fill-slate-50 dark:fill-[hsl(220,25%,6%)]" />
          </svg>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-50 dark:bg-slate-950 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl p-5 mb-6 flex items-center gap-4" data-testid="track-error">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-200 dark:shadow-red-900/50">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-red-700 dark:text-red-400">Order Not Found</p>
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Order Details */}
          {order && (
            <div className="space-y-5" data-testid="order-details">
              {/* Order Header - Gradient Card */}
              <div className="relative rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2), transparent 50%)'
                }} />
                <div className="relative p-6 sm:p-8">
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <p className="text-violet-200 text-[10px] font-bold uppercase tracking-[0.2em]">Order ID</p>
                      <p className="font-mono text-lg sm:text-xl text-white mt-1">#{order.id?.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-violet-200 text-[10px] font-bold uppercase tracking-[0.2em]">Placed On</p>
                      <p className="font-semibold text-white mt-1">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-white/20 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-violet-200 text-sm">Status:</span>
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide backdrop-blur-sm ${
                        isCancelled ? 'bg-red-500/30 text-red-100 border border-red-400/30' :
                        order.order_status === 'delivered' ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/30' :
                        'bg-white/15 text-white border border-white/20'
                      }`}>
                        {order.order_status}
                      </span>
                    </div>
                    <p className="text-3xl font-extrabold text-white">${order.total_amount?.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8">
                <h3 className="font-extrabold text-lg mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  Order Progress
                </h3>
                
                {isCancelled ? (
                  <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 rounded-xl border border-red-200 dark:border-red-800">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                      <XCircle className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-red-700 dark:text-red-400 text-lg">Order Cancelled</p>
                      <p className="text-sm text-red-600 dark:text-red-300">This order has been cancelled. Contact support for more details.</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {ORDER_STATUSES.map((step, index) => {
                      const isCompleted = index <= currentIndex;
                      const isCurrent = index === currentIndex;
                      const Icon = step.icon;
                      const colors = colorMap[step.color];
                      
                      return (
                        <div key={step.key} className="flex gap-4 sm:gap-5 mb-1 last:mb-0">
                          <div className="flex flex-col items-center">
                            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                              isCompleted
                                ? isCurrent
                                  ? `bg-gradient-to-br ${colors.gradFrom} ${colors.gradTo} text-white ring-4 ${colors.ring} shadow-lg`
                                  : `bg-gradient-to-br ${colors.gradFrom} ${colors.gradTo} text-white shadow-md`
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'
                            }`}>
                              {isCompleted && !isCurrent ? (
                                <CheckCircle className="h-5 w-5" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            {index < ORDER_STATUSES.length - 1 && (
                              <div className={`w-0.5 flex-1 min-h-[36px] my-1 rounded-full transition-colors duration-500 ${
                                index < currentIndex ? colors.activeBg : 'bg-slate-200 dark:bg-slate-700'
                              }`} />
                            )}
                          </div>
                          
                          <div className={`pb-7 pt-1.5 ${isCurrent ? '' : 'opacity-60'}`}>
                            <p className={`font-bold text-sm ${isCompleted ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}`}>
                              {step.label}
                            </p>
                            <p className={`text-xs mt-0.5 ${isCompleted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-700'}`}>
                              {step.description}
                            </p>
                            {isCurrent && (
                              <div className={`mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${colors.bg} ${colors.text} border border-current/10`}>
                                <CircleDot className="h-3 w-3 animate-pulse" />
                                Current Status
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                  <ShoppingBag className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  Order Items
                </h3>
                <div className="space-y-2.5">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform" loading="lazy" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate text-slate-800 dark:text-slate-200">{item.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                          <span>Qty: {item.quantity}</span>
                          {item.selected_color && (
                            <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 rounded-full text-[10px]">Color: {item.selected_color}</span>
                          )}
                          {item.selected_size && (
                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full text-[10px]">Size: {item.selected_size}</span>
                          )}
                          {item.selected_shape && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px]">Shape: {item.selected_shape}</span>
                          )}
                          {item.shop_sale_discount && (
                            <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 rounded-full text-[10px] font-bold" data-testid="order-sale-badge">{item.shop_sale_title || `${item.shop_sale_discount}% OFF`}</span>
                          )}
                        </div>
                      </div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">${item.subtotal?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Free Gifts */}
              {order.gifts?.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                    <Gift className="h-5 w-5 text-pink-500" />
                    Free Gifts
                  </h3>
                  <div className="space-y-2.5">
                    {order.gifts.map((gift, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-3 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 rounded-xl border border-pink-200 dark:border-pink-800">
                        {gift.gift_image ? (
                          <img src={gift.gift_image} alt={gift.gift_name} className="w-14 h-14 rounded-xl object-cover border" loading="lazy" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center">
                            <Gift className="h-6 w-6 text-pink-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-pink-800 dark:text-pink-300">{gift.gift_name}</p>
                          <p className="text-xs text-pink-600 dark:text-pink-400">Gift with: {gift.product_name}</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">FREE</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shipping & Payment Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                    <MapPin className="h-4 w-4 text-blue-600" /> Shipping Address
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300 space-y-1 border border-blue-100 dark:border-blue-800">
                    <p className="font-medium">{order.shipping_address?.address}</p>
                    <p>{order.shipping_address?.city}, {order.shipping_address?.state}</p>
                    <p>{order.shipping_address?.zip}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                  <h3 className="font-bold text-sm mb-3 text-slate-900 dark:text-white">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">${((order.total_amount || 0) - (order.delivery_fee || 0) + (order.loyalty_discount_amount || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Delivery Fee</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">${(order.delivery_fee || 0).toFixed(2)}</span>
                    </div>
                    {order.loyalty_points_redeemed > 0 && (
                      <div className="flex justify-between text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">Points ({order.loyalty_points_redeemed} pts)</span>
                        <span className="font-semibold">-${(order.loyalty_discount_amount || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-100 dark:border-slate-700 mt-2">
                      <span className="text-slate-900 dark:text-white">Total Paid</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${order.total_amount?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Payment:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.payment_status === 'paid'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  }`}>
                    {order.payment_status?.charAt(0).toUpperCase() + order.payment_status?.slice(1)}
                  </span>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400 capitalize flex items-center gap-1">
                  <span className="text-slate-400 dark:text-slate-500">via</span> {order.payment_method}
                </span>
              </div>
            </div>
          )}

          {/* No Order Found */}
          {searched && !order && !error && !loading && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
              <Package className="h-16 w-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">No Order Found</h3>
              <p className="text-slate-400 dark:text-slate-500">Please double-check your order ID</p>
            </div>
          )}
        </div>
      </div>

      {/* Sponsored Products - Full width */}
      <div className="w-full">
        <SponsoredProductsGridSection />
      </div>

      {/* Recommended Products - infinite scroll & skeleton loading */}
      <div className="w-full pb-8">
        <RecommendedProductsSection />
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default OrderTrackingPage;
