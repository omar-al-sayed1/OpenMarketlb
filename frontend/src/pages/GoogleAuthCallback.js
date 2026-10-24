import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Mail, MapPin, CheckCircle, MessageCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthContext } from '../App';
import StateSelect from '../components/StateSelect';
import { api } from '../lib/api';
import { toast } from 'sonner';

const COUNTRY_CODE = '+961';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const GoogleAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const ranRef = useRef(false);

  const token = searchParams.get('token');
  const newUser = searchParams.get('new_user') === '1';
  const pendingId = searchParams.get('pending_id');
  const prefillEmail = searchParams.get('email') || '';
  const prefillName = searchParams.get('name') || '';
  const prefillPicture = searchParams.get('picture') || '';
  const googleError = searchParams.get('google_error');

  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Steps: 'form' (collect info) -> 'otp' (verify phone) -> completed
  const [step, setStep] = useState('form');

  // Form state for new users completing signup
  const [form, setForm] = useState({
    name: prefillName,
    phone: '',
    address: '',
    state: '',
  });

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [devCode, setDevCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  const fullPhone = `${COUNTRY_CODE}${form.phone.replace(/\s/g, '').replace(/^0/, '')}`;

  // Token path: existing user — sign them in and redirect
  useEffect(() => {
    if (ranRef.current) return;
    if (token && !newUser) {
      ranRef.current = true;
      (async () => {
        try {
          localStorage.setItem('token', token);
          const { data: me } = await api.auth.getMe();
          login(token, {
            id: me.id,
            email: me.email,
            name: me.name,
            role: me.role,
            shop_id: me.shop_id,
          });
          toast.success('Signed in with Google!');
          if (me.role === 'admin') navigate('/admin');
          else if (me.role === 'shop') navigate('/shop/dashboard');
          else if (me.role === 'delivery') navigate('/delivery/dashboard');
          else if (me.role === 'agent') navigate('/agent');
          else navigate('/');
        } catch (e) {
          toast.error('Failed to complete Google sign-in');
          navigate('/auth');
        }
      })();
    }
  }, [token, newUser, login, navigate]);

  // Show error toast on google_error
  useEffect(() => {
    if (googleError) {
      toast.error(`Google sign-in failed: ${googleError}`);
      setTimeout(() => navigate('/auth'), 1500);
    }
  }, [googleError, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const formatPhone = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 8);
    const match = limited.match(/^(\d{0,2})(\d{0,3})(\d{0,3})$/);
    if (match) return [match[1], match[2], match[3]].filter(Boolean).join(' ');
    return value;
  };

  const validateForm = () => {
    if (!form.state) { toast.error('Please select a state'); return false; }
    if (!form.phone || form.phone.replace(/\D/g, '').length < 7) {
      toast.error('Please enter a valid Lebanese phone number');
      return false;
    }
    return true;
  };

  // Step 1 -> send OTP to the phone
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;
    setSending(true);
    try {
      const { data } = await api.auth.googleOtpSend(pendingId, fullPhone);
      // Dev / fallback mode returns the code so testing is possible without an SMS provider
      if (data.otp_code) {
        setDevCode(data.otp_code);
      } else {
        setDevCode('');
      }
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      setResendCooldown(30);
      toast.success('Verification code sent to your phone');
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await handleSendOtp();
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const nextIdx = Math.min(pasted.length, 5);
    otpRefs.current[nextIdx]?.focus();
  };

  // Step 2 -> verify OTP, then complete signup
  const handleVerifyAndComplete = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Please enter the 6-digit code'); return; }
    setVerifying(true);
    try {
      // 1) verify the phone OTP
      await api.auth.googleOtpVerify(pendingId, fullPhone, code);
      // 2) complete the signup (backend re-checks verification)
      const { data } = await api.auth.googleComplete({
        pending_id: pendingId,
        name: form.name,
        phone: fullPhone,
        address: form.address,
        state: form.state,
      });
      login(data.token, data.user);
      toast.success('Welcome to OpenMarket Lebanon!');
      setCompleted(true);
      setTimeout(() => navigate('/'), 700);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Verification failed. Please try again.';
      toast.error(detail);
      // Clear OTP on invalid code
      if (detail.toLowerCase().includes('code')) {
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } finally {
      setVerifying(false);
    }
  };

  // Pure loading screen while completing token-based login
  if (token && !newUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-white">Signing you in with Google…</p>
        </div>
      </div>
    );
  }

  if (googleError || (!newUser && !token)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-white">Redirecting…</p>
        </div>
      </div>
    );
  }

  // New user — collect extra signup info + verify phone
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center py-8 px-4" data-testid="google-callback-page">
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />
      <div className="absolute top-[-150px] left-[-50px] w-[500px] h-[500px] bg-violet-600/20 rounded-full blur-[150px]" />
      <div className="absolute bottom-[-100px] right-[-50px] w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[130px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {completed ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
              <p className="text-slate-500">Redirecting…</p>
            </div>
          ) : step === 'form' ? (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                {prefillPicture ? (
                  <img src={prefillPicture} alt="Profile" className="w-20 h-20 rounded-full mx-auto mb-3 border-4 border-violet-200 shadow-md" />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <Mail className="h-9 w-9 text-white" />
                  </div>
                )}
                <h2 className="text-2xl font-bold text-slate-900">Welcome, {(form.name || 'there').split(' ')[0]}!</h2>
                <p className="text-sm text-slate-500 mt-1">Just a few more details to finish your account</p>
                {prefillEmail && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
                    <Mail className="h-3 w-3" /> {prefillEmail}
                  </div>
                )}
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4" data-testid="google-signup-form">
                <div>
                  <Label htmlFor="g-name">Full Name *</Label>
                  <Input id="g-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" data-testid="g-name-input" />
                </div>

                <div>
                  <Label htmlFor="g-phone">WhatsApp Phone *</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="flex items-center justify-center px-3 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-medium min-w-[70px]">
                      {COUNTRY_CODE}
                    </div>
                    <Input
                      id="g-phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                      placeholder="71 234 543"
                      className="flex-1"
                      required
                      data-testid="g-phone-input"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> We&apos;ll send a verification code to this number
                  </p>
                </div>

                <div>
                  <Label htmlFor="g-state">State *</Label>
                  <div className="mt-1">
                    <StateSelect value={form.state} onChange={(val) => setForm({ ...form, state: val })} required data-testid="g-state-select" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="g-address">Address (optional)</Label>
                  <Input id="g-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" placeholder="Street, building, ..." data-testid="g-address-input" />
                </div>

                <Button type="submit" disabled={sending || !form.state || !form.phone} className="w-full rounded-xl h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-base font-semibold" data-testid="g-send-otp-button">
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Verification Code'}
                </Button>

                <p className="text-center text-xs text-slate-400">
                  By continuing, you agree to our Terms of Service.
                </p>
              </form>
            </>
          ) : (
            /* OTP STEP */
            <div data-testid="google-otp-step">
              <button
                type="button"
                onClick={() => setStep('form')}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4"
                data-testid="g-otp-back"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Edit details
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Verify your number</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enter the 6-digit code we sent to <span className="font-semibold text-slate-700">{fullPhone}</span>
                </p>
              </div>

              {devCode && (
                <div className="mb-4 text-center text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2" data-testid="g-dev-code">
                  Test mode — your code is <span className="font-bold tracking-widest">{devCode}</span>
                </div>
              )}

              <form onSubmit={handleVerifyAndComplete}>
                <div className="flex justify-center gap-2 mb-5" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 transition-all"
                      data-testid={`g-otp-input-${i}`}
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={verifying || otp.join('').length !== 6}
                  className="w-full rounded-xl h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-base font-semibold"
                  data-testid="g-verify-button"
                >
                  {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Create Account'}
                </Button>
              </form>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || sending}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
                  data-testid="g-resend-otp"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
