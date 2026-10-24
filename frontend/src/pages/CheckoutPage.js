import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CreditCard, Banknote, Phone, User, MapPin, Edit2, Shield, MessageCircle, Clock, RefreshCw, CheckCircle, Loader2, Lock, Gift, Sparkles, FileText, Wallet, ChevronLeft, Truck, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthContext } from '../App';
import StateSelect from '../components/StateSelect';
import CheckoutLocationPicker from '../components/CheckoutLocationPicker';
import SponsoredRow from '../components/SponsoredRow';
import RecommendedProductsSection from '../components/RecommendedProductsSection';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/i18n';

const CheckoutPage = () => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [editingShipping, setEditingShipping] = useState(false);
  const [platformSettings, setPlatformSettings] = useState({ card_payment_enabled: true, otp_verification_enabled: true, available_delivery: true });
  
  // TOS popup state
  const [tosDialogOpen, setTosDialogOpen] = useState(false);
  const [tosContent, setTosContent] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [pendingSubmitEvent, setPendingSubmitEvent] = useState(null);
  
  // OTP Dialog state (for place order flow)
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  
  // Guest OTP state
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef([]);

  // Loyalty state
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [redeemPreview, setRedeemPreview] = useState(null);
  const [redeemSelection, setRedeemSelection] = useState('0');
  const [firstPurchaseBonus, setFirstPurchaseBonus] = useState(null);
  const [walletInfo, setWalletInfo] = useState(null); // { has_wallet, balance, is_shop }
  const [customerLocation, setCustomerLocation] = useState(null); // { lat, lng }
  const [savedLocations, setSavedLocations] = useState([]);
  const [availableStates, setAvailableStates] = useState([]);

  // Helper: smart match a detected state string against the configured states
  const matchStateName = (detected, statesList) => {
    if (!detected || !statesList || statesList.length === 0) return '';
    const norm = (s) => (s || '').toLowerCase().replace(/governorate|mohafazah|district|caza|قضاء|محافظة/gi, '').trim();
    const d = norm(detected);
    if (!d) return '';
    // Exact match first
    for (const st of statesList) {
      if (norm(st.name) === d) return st.name;
    }
    // Contains match
    for (const st of statesList) {
      const sn = norm(st.name);
      if (sn && (d.includes(sn) || sn.includes(d))) return st.name;
    }
    // Specific Lebanese mappings (Nominatim may return varied names)
    const mappings = [
      { keys: ['beirut', 'bayrut'], state: 'Beirut' },
      { keys: ['mount lebanon', 'mont liban', 'jabal lubnan', 'jbeil', 'byblos', 'matn', 'kesrwan', 'kesserwan', 'aley', 'baabda', 'chouf', 'jounieh'], state: 'Mount Lebanon' },
      { keys: ['north', 'tripoli', 'koura', 'akkar', 'zgharta', 'batroun', 'bsharri'], state: 'North Lebanon' },
      { keys: ['south', 'sidon', 'saida', 'tyre', 'sur', 'jezzine', 'nabatieh'], state: 'South Lebanon' },
      { keys: ['bekaa', 'beqaa', 'zahle', 'baalbek', 'hermel', 'rashaya', 'west bekaa'], state: 'Bekaa' },
    ];
    for (const m of mappings) {
      if (m.keys.some(k => d.includes(k))) {
        const found = statesList.find(s => norm(s.name) === norm(m.state));
        if (found) return found.name;
      }
    }
    return '';
  };

  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    payment_method: 'cod',
  });

  const fetchPlatformSettings = useCallback(async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setPlatformSettings(data);
    } catch (error) {
      console.error('Failed to fetch platform settings', error);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    try {
      const { data } = await api.cart.get();
      if (data.items.length === 0) {
        navigate('/cart');
        return;
      }
      setCart(data);
    } catch (error) {
      console.error('Failed to fetch cart', error);
    }
  }, [navigate]);

  const fetchUserData = useCallback(async () => {
    try {
      const { data } = await api.auth.getMe();
      setUserData(data);
      setFormData(prevFormData => ({
        ...prevFormData,
        guest_name: data.name || '',
        guest_email: data.email || '',
        guest_phone: data.phone || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
      }));
    } catch (error) {
      console.error('Failed to fetch user data', error);
    }
  }, []);

  useEffect(() => {
    fetchCart();
    fetchPlatformSettings();
    // Load configured states for smart matching
    api.states.getAll().then(({ data }) => setAvailableStates(data || [])).catch(() => {});
    // Load saved locations for logged-in users
    if (user) {
      api.savedLocations.getAll().then(({ data }) => {
        setSavedLocations(data || []);
        // Auto-select last used location
        if (data && data.length > 0 && !customerLocation) {
          const last = data[0];
          if (last.lat && last.lng) {
            setCustomerLocation({ lat: last.lat, lng: last.lng });
          }
        }
      }).catch(() => {});
    }
  }, [fetchCart, fetchPlatformSettings]);

  // When delivery is platform-disabled, force fee to 0 and ignore location pin
  useEffect(() => {
    if (platformSettings.available_delivery === false) {
      setDeliveryFee(0);
    }
  }, [platformSettings.available_delivery]);

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchLoyaltyStatus();
      checkFirstPurchaseBonus();
      fetchWalletInfo();
    }
  }, [user, fetchUserData]);

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

  const fetchWalletInfo = async () => {
    try {
      const { data } = await api.users.getWalletInfo();
      setWalletInfo(data);
    } catch { setWalletInfo(null); }
  };

  // OTP expiry countdown
  useEffect(() => {
    if (otpExpiry > 0) {
      const timer = setInterval(() => {
        setOtpExpiry(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpExpiry]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);


  const fetchLoyaltyStatus = async () => {
    try {
      const { data } = await api.loyalty.getStatus();
      if (data.enabled) setLoyaltyData(data);
    } catch (error) {
      console.error('Failed to fetch loyalty', error);
    }
  };

  const handleRedeemChange = async (pts) => {
    const maxPts = loyaltyData?.points_balance || 0;
    // Limit points so discount doesn't exceed item total (excluding delivery fee)
    // User must still pay delivery fee
    const redeemRate = loyaltyData?.redeem_rate || 100;
    const maxDiscountAllowed = Math.max(0, total); // total = items only, no delivery
    const maxPointsForDiscount = Math.floor(maxDiscountAllowed * redeemRate);
    const effectiveMax = Math.min(maxPts, maxPointsForDiscount);
    const clamped = Math.max(0, Math.min(pts, effectiveMax));
    setPointsToRedeem(clamped);
    
    if (clamped > 0 && total > 0) {
      try {
        const { data } = await api.loyalty.redeemPreview(clamped, total);
        setRedeemPreview(data);
        setLoyaltyDiscount(data.capped_discount || 0);
      } catch (error) {
        setRedeemPreview(null);
        setLoyaltyDiscount(0);
      }
    } else {
      setRedeemPreview(null);
      setLoyaltyDiscount(0);
    }
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Reset OTP if phone changes
    if (name === 'guest_phone' && phoneVerified) {
      setPhoneVerified(false);
      setOtpSent(false);
      setOtpCode(['', '', '', '', '', '']);
    }
  };

  const handleDeliveryFeeChange = useCallback((fee) => {
    setDeliveryFee(fee);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // OTP handlers for guest checkout
  const handleSendGuestOtp = async () => {
    const phone = formData.guest_phone.replace(/\D/g, '').replace(/^0/, '');
    if (!phone || phone.length < 7) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    const fullPhone = `+961${phone}`;
    setOtpLoading(true);
    try {
      const { data } = await api.otp.send(fullPhone);
      setOtpSent(true);
      setOtpExpiry(data.expires_in || 300);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      if (data.otp_code) {
        toast.success(`Your verification code is: ${data.otp_code}`, { duration: 30000 });
      } else {
        toast.success('Verification code sent to your phone!');
      }
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyGuestOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    const phone = `+961${formData.guest_phone.replace(/\D/g, '').replace(/^0/, '')}`;
    setOtpLoading(true);
    try {
      const { data } = await api.otp.verify(phone, code);
      if (data.valid) {
        setPhoneVerified(true);
        setOtpDialogOpen(false);
        toast.success('Phone verified! Proceeding with order...');
        // Now proceed to TOS
        try {
          const { data: tosData } = await api.tos.get();
          setTosContent(tosData.content || '<p>Terms of service will be provided by admin.</p>');
        } catch {}
        setTosAccepted(false);
        setTosDialogOpen(true);
      } else {
        toast.error('Invalid verification code. Please try again.');
        setOtpCode(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification failed');
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendGuestOtp = async () => {
    if (resendCooldown > 0) return;
    const phone = `+961${formData.guest_phone.replace(/\D/g, '').replace(/^0/, '')}`;
    setOtpLoading(true);
    try {
      const { data } = await api.otp.send(phone);
      setOtpExpiry(data.expires_in || 300);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      toast.success('New verification code sent!');
      otpInputRefs.current[0]?.focus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend code');
    } finally {
      setOtpLoading(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otpCode];
      for (let i = 0; i < digits.length && i + index < 6; i++) {
        newOtp[i + index] = digits[i];
      }
      setOtpCode(newOtp);
      const nextIdx = Math.min(index + digits.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = [...otpCode];
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtpCode(newOtp);
      const nextIdx = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // For non-logged-in users: send OTP on Place Order press
    if (!user && platformSettings.otp_verification_enabled !== false && !phoneVerified) {
      const phone = formData.guest_phone.replace(/\D/g, '').replace(/^0/, '');
      if (!phone || phone.length < 7) {
        toast.error('Please enter a valid phone number');
        return;
      }
      if (!formData.guest_name || !formData.guest_email) {
        toast.error('Please fill in all guest information');
        return;
      }
      if (!formData.state) {
        toast.error('Please select a state');
        return;
      }
      // Auto-send OTP
      const fullPhone = `+961${phone}`;
      setOtpLoading(true);
      try {
        const { data } = await api.otp.send(fullPhone);
        setOtpSent(true);
        setOtpExpiry(data.expires_in || 300);
        setResendCooldown(60);
        setOtpCode(['', '', '', '', '', '']);
        if (data.otp_code) {
          toast.success(`Your verification code is: ${data.otp_code}`, { duration: 30000 });
        } else {
          toast.success('Verification code sent to your phone!');
        }
        // Show OTP verification dialog
        setOtpDialogOpen(true);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 200);
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to send verification code');
      } finally {
        setOtpLoading(false);
      }
      return;
    }
    
    // Always show TOS popup before placing order
    try {
      const { data } = await api.tos.get();
      setTosContent(data.content || '<p>Terms of service will be provided by admin.</p>');
    } catch {}
    setTosAccepted(false);
    setTosDialogOpen(true);
  };

  const proceedWithOrder = async () => {
    setLoading(true);

    try {
      if (!user && (!formData.guest_name || !formData.guest_email || !formData.guest_phone)) {
        toast.error('Please fill in all guest information');
        setLoading(false);
        return;
      }

      // Guest must verify phone via OTP (if enabled)
      if (!user && platformSettings.otp_verification_enabled !== false && !phoneVerified) {
        toast.error('Please verify your phone number before placing the order');
        setLoading(false);
        return;
      }

      // Validate phone for logged-in users
      if (user && !formData.phone) {
        toast.error('Please provide a phone number');
        setLoading(false);
        return;
      }

      // Require location pin (only when delivery is available)
      if (platformSettings.available_delivery !== false && !customerLocation) {
        toast.error('Please pin your delivery location on the map');
        setLoading(false);
        return;
      }

      // Normalize identically to the OTP step (strip non-digits AND a leading 0)
      // so the order's phone matches the number that was OTP-verified.
      const fullPhone = user ? undefined : `+961${formData.guest_phone.replace(/\D/g, '').replace(/^0/, '')}`;

      const orderData = {
        guest_name: user ? undefined : formData.guest_name,
        guest_email: user ? undefined : formData.guest_email,
        guest_phone: fullPhone,
        user_phone: user ? formData.phone : undefined,
        shipping_address: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
        },
        payment_method: formData.payment_method,
        loyalty_points_to_redeem: user && pointsToRedeem > 0 ? pointsToRedeem : 0,
        customer_location: customerLocation || undefined,
      };

      const { data: order } = await api.orders.create(orderData);

      // Save location for future purchases
      if (user && customerLocation) {
        api.savedLocations.save({
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          lat: customerLocation.lat,
          lng: customerLocation.lng,
          label: formData.address || 'Delivery Location',
        }).catch(() => {});
      }

      if (formData.payment_method === 'card') {
        const originUrl = window.location.origin;
        const { data: checkout } = await api.payment.createCheckout(order.id, originUrl);
        window.location.href = checkout.url;
      } else if (formData.payment_method === 'wallet') {
        // Wallet payment - already debited on backend, go to success
        window.dispatchEvent(new Event('cart-updated'));
        window.dispatchEvent(new Event('loyalty-updated'));
        window.dispatchEvent(new Event('wallet-updated'));
        const params = new URLSearchParams({ order_id: order.id });
        if (order.loyalty_points_earned > 0) {
          params.set('points_earned', order.loyalty_points_earned);
          if (order.loyalty_first_purchase_bonus > 0) {
            params.set('first_bonus', order.loyalty_first_purchase_bonus);
          }
        }
        navigate('/order-success?' + params.toString());
      } else {
        window.dispatchEvent(new Event('cart-updated'));
        window.dispatchEvent(new Event('loyalty-updated'));
        // Navigate to success page with points info
        const params = new URLSearchParams({ order_id: order.id });
        if (order.loyalty_points_earned > 0) {
          params.set('points_earned', order.loyalty_points_earned);
          if (order.loyalty_first_purchase_bonus > 0) {
            params.set('first_bonus', order.loyalty_first_purchase_bonus);
          }
        }
        navigate('/order-success?' + params.toString());
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
      setLoading(false);
    }
  };

  const total = cart.items.reduce((sum, item) => {
    const price = item.product.discount_price || item.product.price;
    return sum + price * item.quantity;
  }, 0);

  const totalWithoutDiscount = cart.items.reduce((sum, item) => {
    return sum + item.product.price * item.quantity;
  }, 0);

  const totalSavings = cart.items.reduce((sum, item) => {
    if (item.product.discount_price && item.product.discount_price < item.product.price) {
      return sum + (item.product.price - item.product.discount_price) * item.quantity;
    }
    return sum;
  }, 0);

  const grandTotal = total + deliveryFee - loyaltyDiscount;

  return (
    <div className="min-h-screen bg-slate-50 py-4 sm:py-8 overflow-x-clip" data-testid="checkout-page">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <button onClick={() => navigate('/cart')} className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-violet-600 hover:border-violet-300 transition-all shadow-sm" data-testid="checkout-back-btn">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight" data-testid="checkout-page-title">Checkout</h1>
            <p className="text-xs text-slate-400 mt-0.5">Complete your order securely</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8" data-testid="checkout-progress">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">1</div>
            <span className="text-xs font-semibold text-violet-600 hidden sm:inline">Details</span>
          </div>
          <div className="w-8 sm:w-12 h-px bg-violet-300" />
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">2</div>
            <span className="text-xs font-semibold text-violet-600 hidden sm:inline">Shipping</span>
          </div>
          <div className="w-8 sm:w-12 h-px bg-violet-300" />
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">3</div>
            <span className="text-xs font-medium text-slate-400 hidden sm:inline">Confirm</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">

            {/* Logged-in User Info Summary */}
            {user && userData && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm" data-testid="user-info-summary">
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-100 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h2 className="font-bold text-base text-slate-800">Your Information</h2>
                        <p className="text-xs text-violet-600">Logged in as {userData.name}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingShipping(!editingShipping)}
                      className="text-violet-600 hover:text-violet-700 hover:bg-violet-100 rounded-lg text-xs"
                      data-testid="edit-shipping-btn"
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1" />
                      {editingShipping ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>
                </div>
                
                {!editingShipping ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Name</p>
                      <p className="font-semibold text-sm text-slate-800" data-testid="user-summary-name">{userData.name}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Email</p>
                      <p className="font-semibold text-sm text-slate-800" data-testid="user-summary-email">{userData.email}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Phone</p>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-800" data-testid="user-summary-phone">{formData.phone || 'Not set'}</p>
                        <Lock className="h-3 w-3 text-slate-400" />
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">State</p>
                      <p className="font-semibold text-sm text-slate-800">{formData.state || 'Not set'}</p>
                    </div>
                    {formData.address && (
                      <div className="sm:col-span-2 bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Address</p>
                        <p className="font-semibold text-sm text-slate-800">{formData.address}, {formData.city} {formData.zip}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                    {/* Phone is read-only for logged-in users */}
                    <div>
                      <Label htmlFor="user_phone" className="flex items-center gap-1">Phone <Lock className="h-3 w-3 text-slate-400" /></Label>
                      <Input
                        id="user_phone"
                        name="phone"
                        value={formData.phone}
                        readOnly
                        disabled
                        className="bg-slate-100 cursor-not-allowed opacity-70"
                        data-testid="user-phone-input"
                      />
                      <p className="text-xs text-slate-400 mt-1">Phone cannot be changed at checkout</p>
                    </div>
                    <div>
                      <Label htmlFor="user_address">Address *</Label>
                      <Input
                        id="user_address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        required
                        data-testid="user-address-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="user_city">City *</Label>
                      <Input
                        id="user_city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                        data-testid="user-city-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="user_state">State *</Label>
                      <StateSelect
                        value={formData.state}
                        onChange={(val) => setFormData(prev => ({ ...prev, state: val }))}
                        showDeliveryFee={platformSettings.available_delivery !== false}
                        onDeliveryFeeChange={handleDeliveryFeeChange}
                        disabled={!!customerLocation}
                        data-testid="user-state-select"
                      />
                      {customerLocation && (
                        <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1" data-testid="user-state-locked-hint">
                          <MapPin className="h-3 w-3" /> Locked to your pinned location. Clear the pin to change it.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="user_zip">ZIP Code</Label>
                      <Input
                        id="user_zip"
                        name="zip"
                        value={formData.zip}
                        onChange={handleChange}
                        data-testid="user-zip-input"
                      />
                    </div>
                  </div>
                )}

                {/* No OTP notice for logged-in users */}
                <div className="mx-5 mb-5 flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-xl px-4 py-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">Verified account — no phone verification needed</p>
                </div>
              </div>
            )}

            {/* Guest Information + Phone OTP */}
            {!user && (
              <>
              {/* Loyalty Recommendation for Guests */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200" data-testid="guest-loyalty-recommendation">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                    <Gift className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 text-sm">Earn Rewards on This Purchase!</h3>
                    <p className="text-xs text-amber-700 mt-1">
                      Log in to earn loyalty points on every order. Collect points and redeem them for discounts on future purchases!
                    </p>
                    <p className="text-xs text-slate-500 mt-1 italic">You can still checkout as a guest below.</p>
                    <Link to="/auth" className="inline-flex items-center gap-1.5 mt-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-full transition-colors">
                      <User className="h-3 w-3" /> Log In to Earn Points
                    </Link>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm" data-testid="guest-info-section">
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-slate-800">Guest Information</h2>
                      <p className="text-xs text-slate-400">We need your details to process the order</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="guest_name">Name *</Label>
                    <Input
                      id="guest_name"
                      name="guest_name"
                      value={formData.guest_name}
                      onChange={handleChange}
                      required
                      data-testid="guest-name-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest_email">Email *</Label>
                    <Input
                      id="guest_email"
                      name="guest_email"
                      type="email"
                      value={formData.guest_email}
                      onChange={handleChange}
                      required
                      data-testid="guest-email-input"
                    />
                  </div>
                  
                  {/* Phone number - OTP will be sent on Place Order */}
                  <div className="md:col-span-2">
                    <Label htmlFor="guest_phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number (Lebanon +961) *
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <div className="w-20 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center font-medium">
                        +961
                      </div>
                      <Input
                        id="guest_phone"
                        name="guest_phone"
                        value={formData.guest_phone}
                        onChange={handleChange}
                        placeholder="Phone number (e.g. 71234567)"
                        className={`flex-1 ${phoneVerified ? 'border-emerald-500 bg-emerald-50' : ''}`}
                        required
                        disabled={phoneVerified}
                        data-testid="guest-phone-input"
                      />
                      {phoneVerified && (
                        <div className="flex items-center gap-1 px-3 bg-emerald-100 rounded-lg text-emerald-700 font-medium text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Verified
                        </div>
                      )}
                    </div>
                    {!phoneVerified && (
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        A verification code will be sent to this number when you place your order
                      </p>
                    )}
                  </div>
                </div>
                </div>
              </div>
              </>
            )}

            {/* Location Picker - REQUIRED (only when delivery is available) */}
            {platformSettings.available_delivery !== false && (
            <>
            <CheckoutLocationPicker
              location={customerLocation}
              onLocationChange={setCustomerLocation}
              onAddressDetected={(addr) => {
                const matchedState = matchStateName(addr.state, availableStates);
                setFormData(prev => ({
                  ...prev,
                  address: addr.address || prev.address,
                  city: addr.city || prev.city,
                  state: matchedState || addr.state || prev.state,
                  zip: addr.zip || prev.zip,
                }));
                if (matchedState) {
                  toast.success(`State auto-detected: ${matchedState}`);
                }
              }}
            />
            {!customerLocation && (
              <div className="text-xs text-red-500 flex items-center gap-1 -mt-2 mb-2 px-1" data-testid="location-required-msg">
                <MapPin className="h-3 w-3" /> Pinning your delivery location is required
              </div>
            )}

            {/* Saved Locations */}
            {user && savedLocations.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-4 -mt-2 mb-4" data-testid="saved-locations">
                <p className="text-xs font-semibold text-slate-600 mb-2">Previous Delivery Locations</p>
                <div className="flex flex-wrap gap-2">
                  {savedLocations.slice(0, 3).map(loc => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setCustomerLocation({ lat: loc.lat, lng: loc.lng });
                        setFormData(prev => ({
                          ...prev,
                          address: loc.address || prev.address,
                          city: loc.city || prev.city,
                          state: loc.state || prev.state,
                          zip: loc.zip || prev.zip,
                        }));
                        toast.success('Location loaded');
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        customerLocation?.lat === loc.lat && customerLocation?.lng === loc.lng
                          ? 'bg-violet-50 border-violet-300 text-violet-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-violet-50'
                      }`}
                      data-testid={`saved-location-${loc.id}`}
                    >
                      <MapPin className="h-3 w-3 inline mr-1" />
                      {loc.label || loc.address || `${loc.lat?.toFixed(3)}, ${loc.lng?.toFixed(3)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </>
            )}

            {/* Shipping Address - Only show for guests OR if user is not editing above; HIDDEN when delivery is disabled */}
            {platformSettings.available_delivery !== false && (!user || !editingShipping) && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm" data-testid="shipping-address-section">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-800">Shipping Address</h2>
                    <p className="text-xs text-slate-400">Where should we deliver your order?</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    data-testid="address-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      data-testid="city-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <StateSelect
                      value={formData.state}
                      onChange={(val) => setFormData(prev => ({ ...prev, state: val }))}
                      showDeliveryFee={platformSettings.available_delivery !== false}
                      onDeliveryFeeChange={handleDeliveryFeeChange}
                      disabled={!!customerLocation}
                      data-testid="checkout-state-select"
                    />
                    {customerLocation && (
                      <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1" data-testid="checkout-state-locked-hint">
                        <MapPin className="h-3 w-3" /> Locked to your pinned location. Clear the pin to change it.
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      name="zip"
                      value={formData.zip}
                      onChange={handleChange}
                      data-testid="zip-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm" data-testid="payment-method-section">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-800">Payment Method</h2>
                    <p className="text-xs text-slate-400">Choose how you'd like to pay</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
              <RadioGroup
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                data-testid="payment-method-group"
              >
                {/* Shown when the admin enables it, but not yet selectable — card checkout isn't live. */}
                {platformSettings.card_payment_enabled && (
                  <div className="flex items-center space-x-3 border border-slate-200 rounded-lg p-4 bg-slate-50/60 mb-3 opacity-60">
                    <RadioGroupItem value="card" id="card" data-testid="payment-card-radio" disabled />
                    <Label htmlFor="card" className="flex items-center gap-2 flex-1 cursor-not-allowed">
                      <CreditCard className="h-5 w-5 text-slate-400" />
                      <span className="text-slate-500">Credit/Debit Card</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-brand-secondary/10 text-brand-secondary">
                        coming soon
                      </span>
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-3 border border-slate-200 rounded-lg p-4">
                  <RadioGroupItem value="cod" id="cod" data-testid="payment-cod-radio" />
                  <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Banknote className="h-5 w-5 text-secondary" />
                    <span>Cash on Delivery</span>
                  </Label>
                </div>
                {/* Wallet payment - for shop users */}
                {user && walletInfo?.has_wallet && (
                  <div className={`flex items-center space-x-3 border rounded-lg p-4 mt-3 transition-colors ${
                    walletInfo.balance >= (total + deliveryFee - loyaltyDiscount)
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-red-200 bg-red-50/30 opacity-70'
                  }`}>
                    <RadioGroupItem 
                      value="wallet" 
                      id="wallet" 
                      disabled={walletInfo.balance < (total + deliveryFee - loyaltyDiscount)}
                      data-testid="payment-wallet-radio" 
                    />
                    <Label htmlFor="wallet" className={`flex items-center gap-2 flex-1 ${walletInfo.balance < (total + deliveryFee - loyaltyDiscount) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <Wallet className="h-5 w-5 text-violet-600" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">Pay with Wallet</span>
                          <span className={`text-xs font-bold ${walletInfo.balance >= (total + deliveryFee - loyaltyDiscount) ? 'text-emerald-600' : 'text-red-500'}`}>
                            ${walletInfo.balance.toFixed(2)}
                          </span>
                        </div>
                        {walletInfo.balance < (total + deliveryFee - loyaltyDiscount) ? (
                          <p className="text-[10px] text-red-500">Not enough credits in wallet</p>
                        ) : (
                          <p className="text-[10px] text-emerald-600">Deduct from your shop wallet ({walletInfo.shop_name})</p>
                        )}
                      </div>
                    </Label>
                  </div>
                )}
              </RadioGroup>
              </div>
            </div>

            {/* First Purchase Bonus Banner */}
            {user && firstPurchaseBonus && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200" data-testid="first-purchase-bonus-checkout">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 rounded-full p-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-800 text-sm">First Order Bonus!</p>
                    <p className="text-xs text-emerald-600">This is your first order! You'll earn an extra <strong>+{firstPurchaseBonus} bonus points</strong> on top of your regular points.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loyalty Points Redemption — simple select + apply */}
            {user && loyaltyData && loyaltyData.enabled && loyaltyData.points_balance > 0 && (() => {
              const redeemRate = loyaltyData?.redeem_rate || 100;
              const maxPtsForDisc = Math.floor(Math.max(0, total) * redeemRate);
              const effMax = Math.min(loyaltyData.points_balance, maxPtsForDisc);
              // Build a small set of clean options
              const seen = new Set();
              const options = [];
              const pushOpt = (pts, label) => {
                const p = Math.max(0, Math.floor(pts));
                if (seen.has(p)) return;
                seen.add(p);
                options.push({ points: p, label });
              };
              pushOpt(0, "Don't redeem points");
              [0.25, 0.5, 0.75].forEach((f) => {
                const p = Math.floor(effMax * f);
                if (p > 0 && p < effMax) pushOpt(p, `${p.toLocaleString()} pts  (−$${(p / redeemRate).toFixed(2)})`);
              });
              if (effMax > 0) pushOpt(effMax, `Use Max — ${effMax.toLocaleString()} pts  (−$${(effMax / redeemRate).toFixed(2)})`);

              return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 sm:p-6 border border-amber-200" data-testid="loyalty-redeem-section">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-amber-600" />
                  <h2 className="font-heading font-semibold text-lg text-amber-900">Redeem Loyalty Points</h2>
                </div>
                <p className="text-sm text-amber-700 mb-3">
                  You have <span className="font-bold">{loyaltyData.points_balance.toLocaleString()}</span> points
                  {' '}(worth <span className="font-bold text-emerald-700">${loyaltyData.redeem_value?.toFixed(2)}</span>)
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Select value={redeemSelection} onValueChange={setRedeemSelection}>
                    <SelectTrigger className="flex-1 bg-white border-amber-300 rounded-xl h-11" data-testid="loyalty-redeem-select">
                      <SelectValue placeholder="Choose points to redeem" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt.points} value={String(opt.points)} data-testid={`loyalty-option-${opt.points}`}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={() => handleRedeemChange(parseInt(redeemSelection) || 0)}
                    className="rounded-xl h-11 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                    data-testid="loyalty-apply-btn"
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  Items can be fully covered by points, but the delivery fee (${deliveryFee.toFixed(2)}) must still be paid.
                </p>
                {redeemPreview && redeemPreview.capped_discount > 0 && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-amber-200" data-testid="loyalty-applied-preview">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-700">Points to use</span>
                      <span className="font-semibold">{redeemPreview.points_to_redeem.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-emerald-700 font-medium">Discount applied</span>
                      <span className="font-bold text-emerald-600">-${redeemPreview.capped_discount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-400">Remaining after: {redeemPreview.remaining_balance.toLocaleString()} pts</p>
                      <button
                        type="button"
                        onClick={() => { setRedeemSelection('0'); handleRedeemChange(0); }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                        data-testid="loyalty-remove-btn"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          <div className="lg:col-span-1 lg:sticky lg:top-24 self-start">
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm" data-testid="order-summary">
              {/* Summary Header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 sm:p-5">
                <h2 className="font-bold text-white text-base sm:text-lg">Order Summary</h2>
                <p className="text-violet-200 text-xs mt-0.5">{cart.items.length} item{cart.items.length !== 1 ? 's' : ''}</p>
              </div>
              
              <div className="p-4 sm:p-5">
              <div className="space-y-3 mb-5 max-h-64 overflow-y-auto scrollbar-hide">
                {cart.items.map((item) => {
                  const price = item.product.discount_price || item.product.price;
                  const hasDiscount = item.product.discount_price && item.product.discount_price < item.product.price;
                  const discountPercent = hasDiscount ? Math.round(((item.product.price - item.product.discount_price) / item.product.price) * 100) : 0;
                  
                  const selectedColor = item.selected_color;
                  const selectedSize = item.selected_size;
                  const selectedShape = item.selected_shape;
                  const colorVariant = selectedColor && item.product.colors 
                    ? item.product.colors.find(c => c.color_name === selectedColor) 
                    : null;
                  const displayImage = colorVariant?.image_url || item.product.images?.[0] || '/placeholder.png';
                  const variantLabels = [
                    selectedColor && `Color: ${selectedColor}`,
                    selectedSize && `Size: ${selectedSize}`,
                    selectedShape && `Shape: ${selectedShape}`
                  ].filter(Boolean);
                  
                  return (
                    <div key={`${item.product.id}-${selectedColor || 'default'}`} className="flex gap-3 flex-wrap" data-testid="summary-item">
                      <div className="flex gap-3 w-full">
                      <div className="relative flex-shrink-0">
                        <img 
                          src={displayImage} 
                          alt={`${item.product.name}${variantLabels.length > 0 ? ` - ${variantLabels.join(', ')}` : ''}`}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        {hasDiscount && (
                          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                            -{discountPercent}%
                          </span>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                        {variantLabels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {variantLabels.map((label, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full font-medium">
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity}</p>
                        {item.product.shop_sale_discount && (
                          <span className="inline-flex items-center text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full mt-0.5" data-testid="checkout-sale-badge">
                            {item.product.shop_sale_title || `${item.product.shop_sale_discount}% OFF`}
                          </span>
                        )}
                        {hasDiscount && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-slate-400 line-through">${(item.product.price * item.quantity).toFixed(2)}</span>
                            <span className="text-[10px] text-emerald-600">Save ${((item.product.price - item.product.discount_price) * item.quantity).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <span className="font-semibold text-sm">${(price * item.quantity).toFixed(2)}</span>
                      </div>
                      </div>
                      {/* Gift badge in checkout */}
                      {item.has_free_gift && (
                        <div className="w-full ml-[76px] -mt-1 mb-1 flex items-center gap-1.5 bg-pink-50 rounded-lg px-2 py-1 border border-pink-200" data-testid="checkout-gift-badge">
                          <span className="text-[10px] font-bold text-pink-600">Free Mystery Gift Included</span>
                          <span className="text-[10px] text-pink-400 ml-auto">$0.00</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-dashed border-slate-200 pt-3 mb-4 space-y-2">
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Original Total</span>
                  <span data-testid="checkout-total-no-discount">${totalWithoutDiscount.toFixed(2)}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-600 text-xs">
                    <span className="font-medium">You Save</span>
                    <span className="font-bold" data-testid="checkout-savings">-${totalSavings.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700 text-sm">
                  <span>Subtotal</span>
                  <span className="font-bold">${total.toFixed(2)}</span>
                </div>
                {platformSettings.available_delivery !== false && (
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>Delivery</span>
                    <span data-testid="delivery-fee">
                      {formData.state ? `$${deliveryFee.toFixed(2)}` : (
                        <span className="text-xs italic text-slate-400">Select state</span>
                      )}
                    </span>
                  </div>
                )}
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-amber-600 text-xs font-medium">
                    <span>Loyalty Discount</span>
                    <span data-testid="loyalty-discount">-${loyaltyDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="bg-slate-50 -mx-4 sm:-mx-5 px-4 sm:px-5 py-3 border-t border-slate-100 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">Total</span>
                  <span className="text-xl font-extrabold text-violet-600" data-testid="checkout-total">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !formData.state || otpLoading}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-sm h-12 font-bold shadow-lg shadow-violet-500/20"
                size="lg"
                data-testid="place-order-button"
              >
                {otpLoading ? 'Sending code...' : loading ? 'Processing...' : 'Place Order'}
              </Button>
              {!formData.state && (
                <p className="text-xs text-amber-600 mt-2 text-center">Please select a state to proceed</p>
              )}
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
        </form>

        {/* OTP Verification Dialog (shown on Place Order for guests) */}
        <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
          <DialogContent className="sm:max-w-md" data-testid="otp-verification-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                Verify Your Phone Number
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-slate-600 mb-4 text-center">
                We've sent a 6-digit verification code to <strong>+961{formData.guest_phone}</strong>
              </p>
              
              {/* OTP Input */}
              <div className="flex justify-center gap-2 mb-4" data-testid="dialog-otp-inputs">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className="w-11 h-13 text-center text-xl font-bold border-2 rounded-lg transition-all focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 bg-white"
                    data-testid={`dialog-otp-input-${index}`}
                  />
                ))}
              </div>

              {/* Timer */}
              {otpExpiry > 0 && (
                <div className="flex items-center justify-center gap-1 mb-3 text-xs">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-500">Code expires in <span className="font-semibold text-emerald-600">{formatTime(otpExpiry)}</span></span>
                </div>
              )}
              {otpExpiry === 0 && (
                <div className="text-center mb-3">
                  <span className="text-red-500 text-xs font-medium">Code expired. Please resend.</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleVerifyGuestOtp}
                  disabled={otpLoading || otpCode.join('').length !== 6 || otpExpiry === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11"
                  data-testid="dialog-verify-otp-button"
                >
                  {otpLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Verify & Place Order
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendGuestOtp}
                  disabled={resendCooldown > 0 || otpLoading}
                  className="h-11"
                  data-testid="dialog-resend-otp-button"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {resendCooldown > 0 ? `${resendCooldown}s` : 'Resend'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Terms of Service Dialog */}
        <Dialog open={tosDialogOpen} onOpenChange={setTosDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="tos-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-600" />
                Terms of Service
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 mb-4 border rounded-lg p-4 bg-slate-50 max-h-[50vh]">
              <div 
                className="prose prose-sm prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600"
                dangerouslySetInnerHTML={{ __html: tosContent }}
              />
            </div>
            <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-violet-50 border border-violet-100">
              <Checkbox
                id="tos-accept"
                checked={tosAccepted}
                onCheckedChange={setTosAccepted}
                data-testid="tos-checkbox"
              />
              <label htmlFor="tos-accept" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
                I have read and agree to the <strong>Terms of Service</strong>
              </label>
            </div>
            <Button
              onClick={() => {
                if (tosAccepted) {
                  setTosDialogOpen(false);
                  proceedWithOrder();
                } else {
                  toast.error('Please accept the Terms of Service to continue');
                }
              }}
              disabled={!tosAccepted}
              className="w-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
              data-testid="tos-place-order"
            >
              {tosAccepted ? 'Place Order' : 'Accept Terms to Continue'}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* "Sponsored add-ons" — laptop-only, full page width, 6 per row */}
      <div className="hidden xl:block w-full px-6 lg:px-10 mt-6">
        <SponsoredRow
          surface="cart_checkout"
          title="Sponsored add-ons"
          subtitle="Popular extras you might want"
          variant="grid"
          gridColsClass="grid-cols-6"
          limit={6}
          lowPriceFirst={true}
          excludeProductIds={cart.items.map((i) => i.product?.id).filter(Boolean)}
          data-testid="sponsored-addons-checkout"
        />
      </div>

      {/* Recommended Products — laptop-only, full page width */}
      <div className="pb-8">
        <RecommendedProductsSection
          title="Recommended Picks"
          excludeProductIds={cart.items.map((i) => i.product?.id).filter(Boolean)}
          categoryIds={[...new Set(cart.items.flatMap((i) => [i.product?.category_id, ...(i.product?.category_ids || [])].filter(Boolean)))]}
        />
      </div>
    </div>
  );
};

export default CheckoutPage;
