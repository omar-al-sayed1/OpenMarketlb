import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import BrandName from '../components/BrandName';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AuthContext } from '../App';
import StateSelect from '../components/StateSelect';
import ImageUploader from '../components/ImageUploader';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Check, X, Eye, EyeOff, Store, User, CreditCard, Wallet, Sparkles, ArrowRight, ArrowLeft, Loader2, ShoppingBag, CheckCircle, Clock, Shield, RefreshCw, MessageCircle, Tag, Globe, UserCheck, BadgeCheck } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

// Google G logo (Official multi-color)
const GoogleIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

const COUNTRY_CODE = '+961';

const AuthPage = () => {
  const { t } = useLanguage();
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login'); // 'login', 'signup', 'seller'

  // Read tab from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'signup') {
      setActiveTab('signup');
    } else if (tab === 'seller') {
      setActiveTab('seller');
    }
  }, []);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [sellerStep, setSellerStep] = useState(1); // 1: Account, 2: Shop Details, 3: Subscription
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [platformSettings, setPlatformSettings] = useState({
    subscription_price: 29,
    trial_days: 7,
    commission_percentage: 0,
    card_subscription_enabled: true
  });

  // Real stats for the auth page
  const [realStats, setRealStats] = useState({ products: 0, sellers: 0 });

  // Login OTP state
  const [loginStep, setLoginStep] = useState('credentials'); // 'credentials' | 'otp'
  const [challengeId, setChallengeId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef([]);

  // Signup OTP state
  const [signupStep, setSignupStep] = useState('form'); // 'form' | 'otp'
  const [signupPendingId, setSignupPendingId] = useState('');
  const [signupMaskedPhone, setSignupMaskedPhone] = useState('');
  const [signupOtpCode, setSignupOtpCode] = useState(['', '', '', '', '', '']);
  const [signupOtpExpiry, setSignupOtpExpiry] = useState(0);
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);
  const signupOtpInputRefs = useRef([]);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    first_name: '',
    last_name: '',
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '',
    phone: '', 
    address: '', 
    city: '', 
    state: '', 
    zip: '' 
  });
  const [shopData, setShopData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    logo: ''
  });
  const [sellerFormData, setSellerFormData] = useState({
    name: '', description: '', phone: '', email: '', address: '', state: '', logo: '', guest_name: '', category_ids: []
  });
  const [sellerRequestSent, setSellerRequestSent] = useState(false);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' or 'manual'
  const [gpsDetecting, setGpsDetecting] = useState(false);

  // Auto-detect state from GPS on signup tab
  useEffect(() => {
    if (activeTab === 'signup' && !signupData.state && navigator.geolocation) {
      setGpsDetecting(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { data } = await api.geocode.reverse(position.coords.latitude, position.coords.longitude);
            if (data.state) {
              setSignupData(prev => ({ ...prev, state: data.state, city: data.city || prev.city }));
            }
          } catch {}
          setGpsDetecting(false);
        },
        () => setGpsDetecting(false),
        { timeout: 8000, maximumAge: 60000 }
      );
    }
  }, [activeTab]);

  useEffect(() => {
    fetchPlatformSettings();
    fetchRealStats();
    fetchSellerCategories();
  }, []);

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

  // Signup OTP expiry countdown
  useEffect(() => {
    if (signupOtpExpiry > 0) {
      const timer = setInterval(() => {
        setSignupOtpExpiry(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [signupOtpExpiry]);

  // Signup resend cooldown
  useEffect(() => {
    if (signupResendCooldown > 0) {
      const timer = setInterval(() => {
        setSignupResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [signupResendCooldown]);

  const fetchPlatformSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setPlatformSettings(data);
    } catch (error) {
      console.error('Failed to fetch platform settings');
    }
  };

  const fetchRealStats = async () => {
    try {
      const [productsRes, shopsRes] = await Promise.all([
        api.products.getAll({ is_active: true }),
        api.shops.getAll()
      ]);
      setRealStats({
        products: productsRes.data?.length || 0,
        sellers: shopsRes.data?.length || 0
      });
    } catch (e) { /* ignore */ }
  };

  const fetchSellerCategories = async () => {
    try {
      const { data } = await api.categories.getAll(true);
      setAllCategories(data || []);
    } catch {}
  };

  const toggleSellerCategory = (catId) => {
    setSellerFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter(id => id !== catId)
        : [...prev.category_ids, catId]
    }));
  };

  const handleSellerFormSubmit = async (e) => {
    e.preventDefault();
    if (!sellerFormData.name || !sellerFormData.phone || !sellerFormData.address || !sellerFormData.state) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!sellerFormData.email && !sellerFormData.guest_name) {
      toast.error('Your name and email are required');
      return;
    }
    setSellerLoading(true);
    try {
      await api.shop.registerGuest({
        name: sellerFormData.name,
        phone: sellerFormData.phone,
        address: sellerFormData.address,
        state: sellerFormData.state,
        email: sellerFormData.email,
        description: sellerFormData.description,
        logo: sellerFormData.logo,
        guest_name: sellerFormData.guest_name,
        category_ids: sellerFormData.category_ids || [],
      });
      setSellerRequestSent(true);
      toast.success('Application submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    } finally {
      setSellerLoading(false);
    }
  };

  // Format phone number as "71 234 543"
  const formatPhone = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 8);
    const match = limited.match(/^(\d{0,2})(\d{0,3})(\d{0,3})$/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join(' ');
    }
    return value;
  };

  const handlePhoneChange = (e, isShop = false) => {
    const formatted = formatPhone(e.target.value);
    if (isShop) {
      setShopData({ ...shopData, phone: formatted });
    } else {
      setSignupData({ ...signupData, phone: formatted });
    }
  };

  // Password validation rules
  const passwordValidation = useMemo(() => {
    const password = signupData.password;
    const hasMinLength = password.length >= 8;
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const criteriaCount = [hasLowerCase, hasUpperCase, hasNumbers, hasSpecial].filter(Boolean).length;
    const meetsThreeCriteria = criteriaCount >= 3;
    
    return {
      hasMinLength,
      hasLowerCase,
      hasUpperCase,
      hasNumbers,
      hasSpecial,
      meetsThreeCriteria,
      isValid: hasMinLength && meetsThreeCriteria
    };
  }, [signupData.password]);

  const passwordsMatch = signupData.password === signupData.confirmPassword && signupData.confirmPassword !== '';

  const ValidationItem = ({ passed, label }) => (
    <div className={`flex items-center gap-2 text-sm ${passed ? 'text-emerald-600' : 'text-slate-400'}`}>
      {passed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      <span>{label}</span>
    </div>
  );

  // OTP input handlers
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste
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

  // Google OAuth: start the OAuth flow and redirect to Google
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleSignIn = async (intent = 'login') => {
    try {
      setLoading(true);
      // Defensive: ensure the api method exists (avoids stale bundle "is not a function" crash)
      if (!api?.auth?.googleLogin) {
        console.error('[Google OAuth] api.auth.googleLogin is not defined - stale frontend bundle?');
        toast.error('Please hard-refresh the page (Ctrl+Shift+R) to load latest features');
        setLoading(false);
        return;
      }
      const { data } = await api.auth.googleLogin(intent);
      if (data?.auth_url) {
        // Use replace so back-button doesn't break the OAuth flow
        window.location.replace(data.auth_url);
      } else {
        toast.error('Failed to start Google sign-in');
        setLoading(false);
      }
    } catch (e) {
      // Detailed logging for debugging
      console.error('[Google OAuth] Sign-in error:', e);
      const detail = e?.response?.data?.detail;
      const status = e?.response?.status;
      const msg = detail
        || (status === 0 || !e?.response ? 'Network error — please check your connection' : `Google sign-in failed (${status || 'unknown'})`);
      toast.error(msg);
      setLoading(false);
    }
  };

  // Direct Login (always, no OTP)
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.auth.login(loginData);
      login(data.token, data.user);
      toast.success('Welcome back!');
      // Check for post-login redirect
      const redirectTo = localStorage.getItem('post_login_redirect');
      if (redirectTo) {
        localStorage.removeItem('post_login_redirect');
        navigate(redirectTo);
      } else if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'employee') navigate('/employee');
      else if (data.user.role === 'agent') navigate('/agent');
      else if (data.user.role === 'shop') navigate('/shop/dashboard');
      else if (data.user.role === 'delivery') navigate('/delivery/dashboard');
      else navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Login Step 2: Verify OTP
  const handleLoginVerify = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await api.auth.loginVerify({ 
        challenge_id: challengeId, 
        code 
      });
      login(data.token, data.user);
      toast.success('Welcome back!');
      
      // Check for post-login redirect
      const redirectTo = localStorage.getItem('post_login_redirect');
      if (redirectTo) {
        localStorage.removeItem('post_login_redirect');
        navigate(redirectTo);
      } else if (data.user.role === 'admin') {
        navigate('/admin');
      } else if (data.user.role === 'employee') {
        navigate('/employee');
      } else if (data.user.role === 'agent') {
        navigate('/agent');
      } else if (data.user.role === 'shop') {
        navigate('/shop/dashboard');
      } else if (data.user.role === 'delivery') {
        navigate('/delivery/dashboard');
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification failed');
      // Clear OTP on failure
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { data } = await api.auth.loginResend(challengeId);
      setOtpExpiry(data.expires_in || 300);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      toast.success('New verification code sent!');
      otpInputRefs.current[0]?.focus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  // Go back to credentials from OTP
  const handleBackToCredentials = () => {
    setLoginStep('credentials');
    setChallengeId('');
    setMaskedPhone('');
    setOtpCode(['', '', '', '', '', '']);
    setOtpExpiry(0);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      toast.error('Password does not meet requirements');
      return;
    }
    
    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    if (!signupData.state) {
      toast.error('Please select a state');
      return;
    }

    if (!signupData.phone || signupData.phone.replace(/\D/g, '').length < 7) {
      toast.error('Please enter a valid phone number for WhatsApp verification');
      return;
    }
    
    setLoading(true);
    try {
      // Lebanese numbers: strip leading 0 for international format (03XXX → +9613XXX)
      const cleanPhone = signupData.phone.replace(/\s/g, '').replace(/^0/, '');
      const fullPhone = `${COUNTRY_CODE}${cleanPhone}`;
      const { data } = await api.auth.signupSendOtp({
        ...signupData,
        name: `${signupData.first_name} ${signupData.last_name}`.trim(),
        phone: fullPhone
      });
      setSignupPendingId(data.pending_id);
      setSignupMaskedPhone(data.phone_masked);
      setSignupOtpExpiry(data.expires_in || 300);
      setSignupResendCooldown(60);
      setSignupOtpCode(['', '', '', '', '', '']);
      setSignupStep('otp');
      if (data.otp_code) {
        // Fallback mode: SMS delivery unavailable, show code directly
        toast.success(`Your verification code is: ${data.otp_code}`, { duration: 30000 });
      } else {
        toast.success('Verification code sent to your phone!');
      }
      setTimeout(() => signupOtpInputRefs.current[0]?.focus(), 100);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupVerifyOtp = async () => {
    const code = signupOtpCode.join('');
    if (code.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    
    setLoading(true);
    try {
      const { data } = await api.auth.signupVerify({
        pending_id: signupPendingId,
        code: code
      });
      login(data.token, data.user);
      toast.success('Account created successfully!');
      const redirectTo = localStorage.getItem('post_login_redirect');
      if (redirectTo) {
        localStorage.removeItem('post_login_redirect');
        navigate(redirectTo);
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Verification failed');
      setSignupOtpCode(['', '', '', '', '', '']);
      signupOtpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSignupResendOtp = async () => {
    if (signupResendCooldown > 0) return;
    setLoading(true);
    try {
      await api.auth.signupResendOtp(signupPendingId);
      setSignupResendCooldown(60);
      setSignupOtpCode(['', '', '', '', '', '']);
      toast.success('New verification code sent!');
      signupOtpInputRefs.current[0]?.focus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...signupOtpCode];
    newOtp[index] = value.slice(-1);
    setSignupOtpCode(newOtp);
    if (value && index < 5) {
      signupOtpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSignupOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !signupOtpCode[index] && index > 0) {
      signupOtpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleSignupOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...signupOtpCode];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newOtp[i] = pasted[i];
      }
      setSignupOtpCode(newOtp);
      const nextIdx = Math.min(pasted.length, 5);
      signupOtpInputRefs.current[nextIdx]?.focus();
    }
  };

  // Seller registration flow
  const handleSellerStep1 = async (e) => {
    e.preventDefault();
    
    if (!signupData.first_name || !signupData.email || !signupData.password) {
      toast.error('Please fill in required fields');
      return;
    }

    if (!passwordValidation.isValid) {
      toast.error('Password does not meet requirements');
      return;
    }
    
    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setSellerStep(2);
  };

  const handleSellerStep2 = async (e) => {
    e.preventDefault();
    
    if (!shopData.name || !shopData.phone || !shopData.address || !shopData.state) {
      toast.error('Please fill in all required shop fields');
      return;
    }

    setSellerStep(3);
  };

  const handleSellerSubmit = async () => {
    setLoading(true);
    try {
      // First, create the user account
      const fullPhone = signupData.phone ? `${COUNTRY_CODE}${signupData.phone.replace(/\s/g, '').replace(/^0/, '')}` : '';
      const { data: authData } = await api.auth.signup({
        name: `${signupData.first_name} ${signupData.last_name}`.trim(),
        email: signupData.email,
        password: signupData.password,
        phone: fullPhone,
        address: signupData.address,
        city: signupData.city,
        state: signupData.state || shopData.state,
        zip: signupData.zip
      });
      
      login(authData.token, authData.user);

      // Now register the shop
      const shopPhone = shopData.phone ? `${COUNTRY_CODE}${shopData.phone.replace(/\s/g, '').replace(/^0/, '')}` : '';
      
      if (paymentMethod === 'card' && platformSettings.card_subscription_enabled) {
        // Redirect to Stripe checkout
        const { data } = await api.shop.createCheckoutWithShopData({
          ...shopData,
          phone: shopPhone,
          payment_method: 'card'
        });
        
        if (data.url) {
          toast.info('Redirecting to secure payment...');
          window.location.href = data.url;
        }
      } else {
        // Manual subscription
        await api.shop.register({
          ...shopData,
          phone: shopPhone,
          payment_method: 'manual'
        });
        toast.success('Request sent to admin for approval!');
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Tab buttons at top
  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => { setActiveTab(id); setSellerStep(1); setLoginStep('credentials'); }}
      className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all ${
        activeTab === id
          ? 'bg-white text-violet-700 shadow-lg scale-105'
          : 'text-white/80 hover:text-white hover:bg-white/10'
      }`}
      data-testid={`tab-${id}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  // Step indicator for seller flow
  const StepIndicator = ({ step, current, label }) => (
    <div className="flex items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
        step < current ? 'bg-emerald-500 text-white' :
        step === current ? 'bg-violet-600 text-white ring-4 ring-violet-200' :
        'bg-slate-200 text-slate-500'
      }`}>
        {step < current ? <Check className="h-4 w-4" /> : step}
      </div>
      <span className={`ml-2 text-sm font-medium ${step === current ? 'text-violet-700' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="auth-page">
      {/* Immersive Background - Dark with grid + orbs */}
      <div className="absolute inset-0 bg-slate-950">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
        <div className="absolute top-[-150px] left-[-50px] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-100px] right-[-50px] w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] bg-emerald-500/8 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[30%] w-[200px] h-[200px] bg-pink-500/8 rounded-full blur-[80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-0 px-0 sm:py-8 sm:px-4">
        <div className="w-full max-w-5xl">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white/[0.03] lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none rounded-none sm:rounded-3xl overflow-hidden lg:min-h-[600px]" data-testid="auth-container">
            
            {/* Left Side - Creative Branding Panel */}
            <div className="hidden lg:flex flex-col justify-between bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-l-3xl p-10 text-white relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
              <div className="absolute top-[60%] right-[20%] w-32 h-32 bg-pink-500/8 rounded-full blur-2xl" />
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <img src="/logo.png" alt="Logo" className="h-12 w-12 rounded-xl object-contain shadow-lg" />
                  <span className="text-2xl font-bold"><BrandName showLb /></span>
                </div>
                <h2 className="text-3xl font-extrabold leading-tight mb-4 tracking-tight">
                  {activeTab === 'login' 
                    ? (loginStep === 'otp' ? t('auth.verifyIdentity') || 'Verify Your Identity' : t('auth.welcomeBack'))
                    : activeTab === 'signup' ? t('auth.joinCommunity') : t('auth.startBusiness')}
                </h2>
                <p className="text-white/50 text-base leading-relaxed">
                  {activeTab === 'login' 
                    ? (loginStep === 'otp' 
                      ? 'We sent a verification code to your phone for secure access.'
                      : 'Sign in to manage your account, track orders, and discover amazing products.')
                    : activeTab === 'signup' 
                    ? 'Create your account and start shopping from hundreds of trusted sellers.' 
                    : 'Launch your online store and reach thousands of customers across Lebanon.'}
                </p>
              </div>
              
              <div className="relative space-y-3">
                {[
                  { icon: ShoppingBag, text: `${realStats.products > 0 ? realStats.products.toLocaleString() + '+' : '10,000+'} Products Available`, color: 'from-violet-500/20 to-indigo-500/20 border-violet-500/20' },
                  { icon: Store, text: `${realStats.sellers > 0 ? realStats.sellers.toLocaleString() + '+' : '500+'} Verified Sellers`, color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20' },
                  { icon: Sparkles, text: 'Fast Delivery Nationwide', color: 'from-amber-500/20 to-orange-500/20 border-amber-500/20' },
                  { icon: Shield, text: 'Secure Transactions', color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/20' },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className={`flex items-center gap-3 bg-gradient-to-r ${item.color} border rounded-xl px-4 py-3 backdrop-blur-sm transition-all hover:scale-[1.02]`}>
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-white/80" />
                      </div>
                      <span className="text-white/80 font-medium text-sm">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Side - Forms */}
            <div className="flex flex-col bg-white lg:rounded-r-3xl lg:rounded-l-none">
              {/* Mobile Logo */}
              <div className="lg:hidden text-center pt-6 pb-4 bg-slate-950">
                <img src="/logo.png" alt="OpenMarketlb" className="h-14 w-14 mx-auto mb-2 rounded-xl object-contain" />
                <h1 className="text-xl font-extrabold"><BrandName showLb /></h1>
              </div>

              {/* Tab Buttons */}
              <div className="flex border-b bg-slate-50/80">
                {[
                  { id: 'login', label: t('auth.login'), icon: User },
                  { id: 'signup', label: t('auth.signup'), icon: ShoppingBag },
                  { id: 'seller', label: 'Sell', icon: Store },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setSellerStep(1); setLoginStep('credentials'); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all border-b-2 ${
                        activeTab === tab.id
                          ? 'border-violet-600 text-violet-700 bg-white'
                          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/50'
                      }`}
                      data-testid={`tab-${tab.id}`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

            {/* Login Tab */}
            {activeTab === 'login' && (
              <div className="p-6 sm:p-8 flex-1 flex flex-col lg:justify-center">
                <h2 className="text-2xl font-heading font-bold mb-1" data-testid="auth-title">{t('auth.login')}</h2>
                <p className="text-slate-500 text-sm mb-6">{t('auth.welcomeDesc')}</p>
                <form onSubmit={handleLogin} className="space-y-4" data-testid="login-form">
                  <div>
                    <Label htmlFor="login-email">{t('auth.email')}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                      className="mt-1"
                      placeholder="your@email.com"
                      data-testid="login-email-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <div className="relative mt-1">
                      <Input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        placeholder="Enter your password"
                        data-testid="login-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        data-testid="login-toggle-password"
                        tabIndex={-1}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-base font-semibold"
                    data-testid="login-submit-button"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : t('auth.login')}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">or</span></div>
                </div>

                {/* Google Login Button */}
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn('login')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 font-semibold text-sm shadow-sm disabled:opacity-60"
                  data-testid="google-login-button"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Continue with Google
                </button>

                <p className="text-center mt-6 text-sm text-slate-500">
                  {t('auth.noAccount')}{' '}
                  <button onClick={() => setActiveTab('signup')} className="text-violet-600 font-semibold hover:underline">
                    {t('auth.signup')}
                  </button>
                </p>
              </div>
            )}

            {/* Signup Tab */}
            {activeTab === 'signup' && (
              <div className="p-8 flex-1 overflow-y-auto" style={{maxHeight: '520px'}}>
                {signupStep === 'form' ? (
                  <>
                <h2 className="text-2xl font-heading font-bold mb-1" data-testid="auth-title">{t('auth.createAccount')}</h2>
                <p className="text-slate-500 text-sm mb-5">{t('auth.joinDesc')}</p>

                {/* Sign up with Google — shown at the TOP of the signup section */}
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn('signup')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 font-semibold text-sm shadow-sm disabled:opacity-60"
                  data-testid="google-signup-button-top"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Sign up with Google
                </button>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">or sign up with email</span></div>
                </div>

                <form onSubmit={handleSignup} className="space-y-4" data-testid="signup-form">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="signup-first-name">First Name *</Label>
                      <Input
                        id="signup-first-name"
                        value={signupData.first_name}
                        onChange={(e) => setSignupData({ ...signupData, first_name: e.target.value })}
                        required
                        className="mt-1"
                        placeholder="First name"
                        data-testid="signup-first-name-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-last-name">Last Name</Label>
                      <Input
                        id="signup-last-name"
                        value={signupData.last_name}
                        onChange={(e) => setSignupData({ ...signupData, last_name: e.target.value })}
                        className="mt-1"
                        placeholder="Last name"
                        data-testid="signup-last-name-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      required
                      className="mt-1"
                      placeholder="your@email.com"
                      data-testid="signup-email-input"
                    />
                  </div>
                  
                  {/* Password */}
                  <div>
                    <Label htmlFor="signup-password">Password *</Label>
                    <div className="relative mt-1">
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        required
                        className="pr-10"
                        data-testid="signup-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    
                    {signupData.password && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-2">
                        <ValidationItem passed={passwordValidation.hasMinLength} label="At least 8 characters" />
                        <div className="text-sm text-slate-600 font-medium mt-2">At least 3 of the following:</div>
                        <div className="ml-2 space-y-1">
                          <ValidationItem passed={passwordValidation.hasLowerCase} label="Lower case letters (a-z)" />
                          <ValidationItem passed={passwordValidation.hasUpperCase} label="Upper case letters (A-Z)" />
                          <ValidationItem passed={passwordValidation.hasNumbers} label="Numbers (0-9)" />
                          <ValidationItem passed={passwordValidation.hasSpecial} label="Special characters (optional)" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <Label htmlFor="signup-confirm-password">Retype Password *</Label>
                    <div className="relative mt-1">
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                        required
                        className={`pr-10 ${signupData.confirmPassword && (passwordsMatch ? 'border-emerald-500' : 'border-red-500')}`}
                        data-testid="signup-confirm-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {signupData.confirmPassword && !passwordsMatch && (
                      <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <Label htmlFor="signup-phone">WhatsApp Phone Number *</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="flex items-center justify-center px-3 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-medium min-w-[70px]">
                        {COUNTRY_CODE}
                      </div>
                      <Input
                        id="signup-phone"
                        value={signupData.phone}
                        onChange={(e) => handlePhoneChange(e)}
                        placeholder="71 234 543"
                        className="flex-1"
                        required
                        data-testid="signup-phone-input"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      A WhatsApp verification code will be sent to this number
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="signup-address">Address</Label>
                    <Input
                      id="signup-address"
                      value={signupData.address}
                      onChange={(e) => setSignupData({ ...signupData, address: e.target.value })}
                      className="mt-1"
                      data-testid="signup-address-input"
                    />
                  </div>

                  <div>
                    <Label htmlFor="signup-state">State * {gpsDetecting && <span className="text-xs text-violet-500 ml-1 animate-pulse">Detecting...</span>}</Label>
                    <div className="mt-1">
                      <StateSelect
                        value={signupData.state}
                        onChange={(val) => setSignupData({ ...signupData, state: val })}
                        required
                        data-testid="signup-state-select"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !passwordValidation.isValid || !passwordsMatch || !signupData.state}
                    className="w-full rounded-xl h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-base font-semibold disabled:opacity-50"
                    data-testid="signup-submit-button"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create Account'}
                  </Button>
                  {/* Show reason when button is disabled */}
                  {(!passwordValidation.isValid || !passwordsMatch || !signupData.state) && (
                    <p className="text-xs text-red-500 text-center mt-2" data-testid="signup-disabled-reason">
                      {!signupData.first_name ? 'First name is required' :
                       !signupData.email ? 'Email is required' :
                       !passwordValidation.isValid ? 'Password does not meet requirements' :
                       !passwordsMatch ? 'Passwords do not match' :
                       !signupData.state ? 'Please select a state' : ''}
                    </p>
                  )}
                </form>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">or</span></div>
                </div>

                {/* Google Signup Button */}
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn('signup')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 font-semibold text-sm shadow-sm disabled:opacity-60"
                  data-testid="google-signup-button"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Sign up with Google
                </button>

                <p className="text-center mt-6 text-sm text-slate-500">
                  Already have an account?{' '}
                  <button onClick={() => setActiveTab('login')} className="text-violet-600 font-semibold hover:underline">
                    Login
                  </button>
                </p>
                  </>
                ) : (
                  /* OTP Verification Step */
                  <div className="flex flex-col items-center justify-center py-4" data-testid="signup-otp-step">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <MessageCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-heading font-bold mb-2">Verify Your Phone</h2>
                    <p className="text-slate-500 text-sm text-center mb-2">
                      We sent a verification code via WhatsApp to
                    </p>
                    <p className="text-slate-800 font-semibold mb-6" data-testid="signup-otp-masked-phone">{signupMaskedPhone}</p>
                    
                    {/* OTP Input */}
                    <div className="flex gap-2 mb-4" data-testid="signup-otp-inputs">
                      {signupOtpCode.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => signupOtpInputRefs.current[index] = el}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleSignupOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleSignupOtpKeyDown(index, e)}
                          onPaste={index === 0 ? handleSignupOtpPaste : undefined}
                          className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all"
                          data-testid={`signup-otp-input-${index}`}
                        />
                      ))}
                    </div>

                    {/* Timer */}
                    {signupOtpExpiry > 0 && (
                      <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Code expires in {Math.floor(signupOtpExpiry / 60)}:{(signupOtpExpiry % 60).toString().padStart(2, '0')}
                      </p>
                    )}

                    {/* Verify Button */}
                    <Button
                      onClick={handleSignupVerifyOtp}
                      disabled={loading || signupOtpCode.join('').length !== 6}
                      className="w-full rounded-xl h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-base font-semibold disabled:opacity-50 mb-3"
                      data-testid="signup-verify-otp-button"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <span className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Verify & Create Account</span>
                      )}
                    </Button>

                    {/* Resend */}
                    <button
                      onClick={handleSignupResendOtp}
                      disabled={signupResendCooldown > 0 || loading}
                      className="text-sm text-violet-600 hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1"
                      data-testid="signup-resend-otp-button"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {signupResendCooldown > 0 ? `Resend in ${signupResendCooldown}s` : 'Resend Code'}
                    </button>

                    {/* Back button */}
                    <button
                      onClick={() => { setSignupStep('form'); setSignupOtpCode(['', '', '', '', '', '']); }}
                      className="mt-4 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      data-testid="signup-otp-back-button"
                    >
                      <ArrowLeft className="h-3 w-3" /> Back to form
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Seller Tab - Full Application Form */}
            {activeTab === 'seller' && (
              <div className="p-6 sm:p-8 flex-1 overflow-y-auto" style={{maxHeight: '520px'}}>
                {sellerRequestSent ? (
                  <div className="flex flex-col items-center justify-center py-8" data-testid="seller-request-sent">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Application Sent!</h2>
                    <p className="text-slate-500 text-sm text-center mb-4">You'll receive a notification once your shop is approved.</p>
                    <Button onClick={() => navigate('/')} className="rounded-full bg-emerald-500 hover:bg-emerald-600" data-testid="seller-continue-shopping">Continue Shopping</Button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-heading font-bold mb-1" data-testid="seller-form-title">Start Selling</h2>
                    <p className="text-slate-500 text-sm mb-5">Fill in your shop details. Our team will review and get back to you.</p>

                    <form onSubmit={handleSellerFormSubmit} className="space-y-4" data-testid="seller-application-form">
                      {/* Personal Info */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center"><UserCheck className="h-3.5 w-3.5 text-violet-600" /></div>
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Your Information</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-semibold text-slate-600">Your Full Name *</Label>
                            <Input value={sellerFormData.guest_name} onChange={(e) => setSellerFormData({ ...sellerFormData, guest_name: e.target.value })} placeholder="John Doe" className="mt-1 h-10 rounded-xl" data-testid="seller-guest-name" />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-600">Your Email *</Label>
                            <Input type="email" value={sellerFormData.email} onChange={(e) => setSellerFormData({ ...sellerFormData, email: e.target.value })} placeholder="you@example.com" className="mt-1 h-10 rounded-xl" data-testid="seller-guest-email" />
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Shield className="h-3 w-3 text-emerald-500" />
                          Already have an account? <button type="button" onClick={() => setActiveTab('login')} className="font-semibold text-violet-600 hover:text-violet-800 underline">Login here</button> for faster application.
                        </p>
                      </div>

                      <div className="border-b border-dashed border-slate-200" />

                      {/* Shop Details */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center"><Store className="h-3.5 w-3.5 text-emerald-600" /></div>
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Shop Details</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-semibold text-slate-600">Shop Name *</Label>
                            <Input value={sellerFormData.name} onChange={(e) => setSellerFormData({ ...sellerFormData, name: e.target.value })} placeholder="e.g. Beirut Boutique" className="mt-1 h-10 rounded-xl" data-testid="seller-shop-name" />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-600">Phone *</Label>
                            <Input value={sellerFormData.phone} onChange={(e) => setSellerFormData({ ...sellerFormData, phone: e.target.value })} placeholder="+961 ..." className="mt-1 h-10 rounded-xl" data-testid="seller-shop-phone" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-600">Description</Label>
                          <Textarea value={sellerFormData.description} onChange={(e) => setSellerFormData({ ...sellerFormData, description: e.target.value })} placeholder="Tell us about your shop..." rows={2} className="mt-1 rounded-xl" data-testid="seller-shop-description" />
                        </div>
                        <div>
                          <ImageUploader value={sellerFormData.logo} onChange={(url) => setSellerFormData({ ...sellerFormData, logo: url })} label="Shop Logo (optional)" showUrlInput={true} aspect={1} />
                        </div>
                        {/* Categories */}
                        <div data-testid="seller-form-categories">
                          <div className="flex items-center justify-between mb-1.5">
                            <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                              <Tag className="h-3.5 w-3.5 text-emerald-600" />
                              Categories
                            </Label>
                            {sellerFormData.category_ids.length > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 rounded-full px-2 py-0.5 border border-emerald-100">
                                {sellerFormData.category_ids.length} selected
                              </span>
                            )}
                          </div>
                          {allCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {allCategories.map(cat => {
                                const selected = sellerFormData.category_ids.includes(cat.id);
                                return (
                                  <button key={cat.id} type="button" onClick={() => toggleSellerCategory(cat.id)}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border cursor-pointer ${
                                      selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-300'
                                    }`}
                                    data-testid={`seller-cat-${cat.id}`}
                                  >
                                    {cat.name} {selected && <span className="ml-1">&#10003;</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-b border-dashed border-slate-200" />

                      {/* Location */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><Globe className="h-3.5 w-3.5 text-blue-600" /></div>
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Location</h3>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-600">Address *</Label>
                          <Input value={sellerFormData.address} onChange={(e) => setSellerFormData({ ...sellerFormData, address: e.target.value })} placeholder="Street, Building, City" className="mt-1 h-10 rounded-xl" data-testid="seller-shop-address" />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-600">State/Region *</Label>
                          <div className="mt-1">
                            <StateSelect value={sellerFormData.state} onChange={(val) => setSellerFormData({ ...sellerFormData, state: val })} />
                          </div>
                        </div>
                      </div>

                      {/* Submit */}
                      <Button type="submit" disabled={sellerLoading} className="w-full rounded-xl h-11 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg" data-testid="seller-submit-application">
                        {sellerLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                        Submit Application
                      </Button>
                      <p className="text-center text-[11px] text-slate-400">
                        By submitting, you agree to our terms. Our team will review within 24-48 hours.
                      </p>
                    </form>
                  </>
                )}
              </div>
            )}
          </div>
          </div>

          {/* Footer */}
          <p className="text-center mt-6 text-white/30 text-sm">
            &copy; 2026 <span className="font-semibold"><BrandName showLb dim /></span>. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
