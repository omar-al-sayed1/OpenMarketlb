import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, Package, Loader2, Gift, Truck, Star, X, Sparkles, MapPin, Mail, ArrowRight, ShoppingBag, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import { toast } from 'sonner';

const OrderSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');
  const pointsEarned = parseInt(searchParams.get('points_earned')) || 0;
  const firstBonus = parseInt(searchParams.get('first_bonus')) || 0;
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [order, setOrder] = useState(null);
  const [polling, setPolling] = useState(false);
  const [showPointsPopup, setShowPointsPopup] = useState(false);
  const [showGiftPopup, setShowGiftPopup] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else if (orderId) {
      fetchOrder();
    }
  }, [sessionId, orderId]);

  // Show points popup after a brief delay
  useEffect(() => {
    if (pointsEarned > 0 && (orderId || paymentStatus === 'paid')) {
      const timer = setTimeout(() => setShowPointsPopup(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [pointsEarned, orderId, paymentStatus]);

  // Hide confetti after 4s
  useEffect(() => {
    if (paymentStatus === 'paid' || orderId) {
      const t = setTimeout(() => setShowConfetti(false), 4500);
      return () => clearTimeout(t);
    }
  }, [paymentStatus, orderId]);

  // Show gift popup if order has gifts
  useEffect(() => {
    if (order?.gifts?.length > 0) {
      const timer = setTimeout(() => setShowGiftPopup(true), pointsEarned > 0 ? 3000 : 1500);
      return () => clearTimeout(timer);
    }
  }, [order, pointsEarned]);

  const fetchOrder = async () => {
    try {
      const { data } = await api.orders.getById(orderId);
      setOrder(data);
      setPaymentStatus(data.payment_status);
    } catch (error) {
      console.error('Failed to fetch order', error);
    }
  };

  const pollPaymentStatus = async (attempts = 0) => {
    if (attempts >= 5) {
      setPaymentStatus('timeout');
      return;
    }
    setPolling(true);
    try {
      const { data } = await api.payment.checkStatus(sessionId);
      setPaymentStatus(data.payment_status);
      if (data.payment_status === 'paid') {
        setPolling(false);
        toast.success('Payment successful!');
        // Try to fetch the order linked with session
        try {
          const oid = data.metadata?.order_id;
          if (oid) {
            const { data: ord } = await api.orders.getById(oid);
            setOrder(ord);
          }
        } catch (_) {}
        return;
      } else if (data.status === 'expired') {
        setPolling(false);
        toast.error('Payment session expired');
        return;
      }
      setTimeout(() => pollPaymentStatus(attempts + 1), 2000);
    } catch (error) {
      setPolling(false);
      console.error('Failed to check payment status', error);
    }
  };

  // Confetti pieces (CSS-only)
  const confettiPieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2.5,
    color: ['#f59e0b', '#10b981', '#b4f56a', '#ec4899', '#22d3ee'][Math.floor(Math.random() * 5)],
  }));

  const isSuccess = paymentStatus === 'paid' || orderId;
  const trackingHref = order?.id ? `/track-order/${order.id}` : null;
  const orderShortId = order?.id ? `#${order.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-violet-50 py-10 sm:py-16 overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl" />

      {/* Confetti */}
      {showConfetti && isSuccess && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {confettiPieces.map((p) => (
            <span
              key={p.id}
              className="absolute -top-4 block h-2 w-2 rounded-sm opacity-90"
              style={{
                left: `${p.left}%`,
                backgroundColor: p.color,
                animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.4); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="relative mx-auto w-full max-w-3xl px-4">
        {polling ? (
          <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-slate-100 p-10 sm:p-14 text-center" data-testid="order-success-container">
            <Loader2 className="h-20 w-20 text-violet-600 mx-auto mb-6 animate-spin" data-testid="loading-spinner" />
            <h1 className="text-3xl font-heading font-bold mb-3">Confirming your payment…</h1>
            <p className="text-slate-600">Hold tight, we're securing your order.</p>
          </div>
        ) : isSuccess ? (
          <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-slate-100 overflow-hidden" data-testid="order-success-container">
            {/* Top hero */}
            <div className="relative px-6 pt-12 pb-10 text-center bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.25),transparent_60%)]" aria-hidden="true" />
              <div className="relative mx-auto h-24 w-24 rounded-full bg-white/15 ring-8 ring-white/10 flex items-center justify-center" style={{ animation: 'pop-in .6s ease-out both' }}>
                <CheckCircle className="h-14 w-14 text-white drop-shadow" data-testid="success-icon" />
              </div>
              <h1 className="mt-6 text-3xl sm:text-4xl font-heading font-extrabold tracking-tight" data-testid="success-title">
                Thank you{order?.contact_name ? `, ${order.contact_name.split(' ')[0]}` : ''}! 🎉
              </h1>
              <p className="mt-2 text-emerald-50 text-base sm:text-lg">
                Your order has been placed successfully.
              </p>
              {orderShortId && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-sm font-semibold ring-1 ring-white/30">
                  <Package className="h-4 w-4" /> Order {orderShortId}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="px-6 sm:px-10 py-8 sm:py-10">
              {/* Status timeline */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center text-xs sm:text-sm font-semibold">
                <div className="flex flex-col items-center text-emerald-600">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  Order Placed
                </div>
                <div className="flex flex-col items-center text-slate-400">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  Preparing
                </div>
                <div className="flex flex-col items-center text-slate-400">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Truck className="h-5 w-5" />
                  </div>
                  On the Way
                </div>
              </div>

              {/* Key info cards */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 flex items-center gap-3" data-testid="delivery-estimate-banner">
                  <div className="bg-emerald-100 rounded-full p-2.5"><Truck className="h-5 w-5 text-emerald-700" /></div>
                  <div className="text-left">
                    <p className="text-xs text-emerald-700/80 font-medium">Estimated Delivery</p>
                    <p className="font-bold text-emerald-900">2–3 days</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 flex items-center gap-3">
                  <div className="bg-blue-100 rounded-full p-2.5"><Mail className="h-5 w-5 text-blue-700" /></div>
                  <div className="text-left">
                    <p className="text-xs text-blue-700/80 font-medium">Confirmation</p>
                    <p className="font-bold text-blue-900">Sent to your email</p>
                  </div>
                </div>
                {(order?.loyalty_points_earned > 0 || pointsEarned > 0) && (
                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 flex items-center gap-3" data-testid="points-earned-banner">
                    <div className="bg-amber-100 rounded-full p-2.5"><Gift className="h-5 w-5 text-amber-700" /></div>
                    <div className="text-left">
                      <p className="text-xs text-amber-700/80 font-medium">Loyalty Reward</p>
                      <p className="font-bold text-amber-900">+{order?.loyalty_points_earned || pointsEarned} points earned</p>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 flex items-center gap-3">
                  <div className="bg-violet-100 rounded-full p-2.5"><Clock className="h-5 w-5 text-violet-700" /></div>
                  <div className="text-left">
                    <p className="text-xs text-violet-700/80 font-medium">Updates</p>
                    <p className="font-bold text-violet-900">Real-time tracking available</p>
                  </div>
                </div>
              </div>

              {/* Order summary */}
              {order && (
                <div className="mt-7 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-heading font-bold text-base">Order Summary</h2>
                    <span className="text-xs text-slate-500" data-testid="order-id">ID: {order.id.slice(0, 12)}…</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total</span>
                      <span className="font-bold text-slate-900" data-testid="order-amount">${Number(order.total_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment</span>
                      <span className="font-semibold capitalize text-slate-800" data-testid="payment-method">{order.payment_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="font-semibold capitalize text-emerald-700" data-testid="order-status">{order.order_status}</span>
                    </div>
                    {order.shipping_address?.city && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Shipping</span>
                        <span className="font-semibold text-slate-800">{order.shipping_address.city}{order.shipping_address.state ? `, ${order.shipping_address.state}` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                {trackingHref && (
                  <Button asChild className="rounded-full h-12 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200">
                    <Link to={trackingHref} data-testid="track-order-button">
                      <Truck className="mr-2 h-4 w-4" /> Track Your Order
                    </Link>
                  </Button>
                )}
                <Button onClick={() => navigate('/products')} variant="outline" className="rounded-full h-12 px-6 border-2" data-testid="continue-shopping-success-button">
                  <ShoppingBag className="mr-2 h-4 w-4" /> Continue Shopping
                </Button>
                <Button onClick={() => navigate('/profile')} variant="ghost" className="rounded-full h-12 px-6" data-testid="view-orders-button">
                  <Package className="mr-2 h-4 w-4" /> All Orders <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              {/* Helpful note */}
              <p className="mt-6 text-center text-xs text-slate-500">
                Need help? Contact our <Link to="/contact" className="text-emerald-700 font-semibold hover:underline">customer support</Link>.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-slate-100 p-10 sm:p-14 text-center">
            <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="h-10 w-10 text-red-500" />
            </div>
            <h1 className="text-3xl font-heading font-bold mb-3">Payment Failed</h1>
            <p className="text-slate-600 mb-8">There was an issue processing your payment. Please try again.</p>
            <Button onClick={() => navigate('/checkout')} className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" data-testid="retry-payment-button">
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Points Earned Celebration Popup */}
      {showPointsPopup && pointsEarned > 0 && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" onClick={() => setShowPointsPopup(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-sm" data-testid="points-popup">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ animation: 'pop-in .35s ease-out both' }}>
              <div className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 p-6 text-center relative">
                <button onClick={() => setShowPointsPopup(false)} className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
                  <X className="h-4 w-4" />
                </button>
                <div className="w-16 h-16 mx-auto mb-3 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Star className="h-8 w-8 text-white fill-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Points Earned!</h2>
              </div>
              <div className="p-6 text-center">
                <p className="text-5xl font-extrabold text-amber-600 mb-1">+{pointsEarned}</p>
                <p className="text-sm text-slate-600 mb-4">loyalty points added to your account</p>
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-left text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Order Points</span>
                    <span className="font-semibold text-amber-700">+{pointsEarned - firstBonus}</span>
                  </div>
                  {firstBonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-violet-500" /> First Order Bonus</span>
                      <span className="font-semibold text-violet-600">+{firstBonus}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span className="text-slate-700">Total Earned</span>
                    <span className="text-amber-600">+{pointsEarned}</span>
                  </div>
                </div>
                <Button onClick={() => setShowPointsPopup(false)} className="w-full mt-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  Awesome!
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Gift Reveal Popup */}
      {showGiftPopup && order?.gifts?.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={() => setShowGiftPopup(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-sm" data-testid="gift-popup">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ animation: 'pop-in .35s ease-out both' }}>
              <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 p-6 text-center relative">
                <button onClick={() => setShowGiftPopup(false)} className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
                  <X className="h-4 w-4" />
                </button>
                <div className="w-16 h-16 mx-auto mb-3 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Gift className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">You Got a Free Gift!</h2>
                <p className="text-pink-100 text-sm mt-1">A special bonus with your order</p>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {order.gifts.map((gift, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-pink-50 rounded-xl p-3 border border-pink-200">
                      {gift.gift_image ? (
                        <img src={gift.gift_image} alt={gift.gift_name} className="w-14 h-14 rounded-lg object-cover border" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-pink-100 flex items-center justify-center">
                          <Gift className="h-6 w-6 text-pink-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-pink-800 text-sm">{gift.gift_name}</p>
                        <p className="text-xs text-pink-600">Gift with: {gift.product_name}</p>
                        <p className="text-xs text-pink-500">Qty: {gift.quantity}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">FREE</span>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setShowGiftPopup(false)} className="w-full mt-4 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                  Amazing!
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrderSuccessPage;
