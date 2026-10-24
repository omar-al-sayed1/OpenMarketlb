import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Alert } from '../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';
import { Input } from '../components/ui';
import BottomSheet from '../components/BottomSheet';
import GoogleLogo from '../components/GoogleLogo';

// Parse OAuth return params from either the query string OR the URL fragment (#),
// so the deep-link result is read reliably regardless of how the redirect is formed.
function parseAuthParams(url) {
  const params = { ...(Linking.parse(url).queryParams || {}) };
  const hash = (url.split('#')[1] || '');
  if (hash) hash.split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return params;
}

WebBrowser.maybeCompleteAuthSession();

const CC = '+961'; // country code (matches website)
const cleanPhone = (p) => (p || '').replace(/\D/g, '').replace(/^0/, '');
const fullPhone = (p) => { const c = cleanPhone(p); return c ? `${CC}${c}` : ''; };

const RULES = [
  { key: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'num', label: 'One number', test: (p) => /[0-9]/.test(p) },
];

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', password: '', confirm: '' };

export default function AuthScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { login, signup, loginWithToken } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // States are picked from a list (not typed).
  const [states, setStates] = useState([]);
  const [stateTarget, setStateTarget] = useState(null); // 'signup' | 'google' | null
  const [stateQuery, setStateQuery] = useState('');
  useEffect(() => { api.states.getAll().then(({ data }) => setStates((Array.isArray(data) ? data : data?.states || []).map((s) => s.name || s).filter(Boolean))).catch(() => {}); }, []);

  // Google new-account completion state
  const [gPending, setGPending] = useState(null); // { pending_id, email, name }
  const [g, setG] = useState({ name: '', phone: '', state: '', address: '' });
  const [gStep, setGStep] = useState('info'); // 'info' | 'otp'
  const [gCode, setGCode] = useState('');
  const [gSending, setGSending] = useState(false);

  const rulesOk = RULES.every((r) => r.test(f.password));
  const match = f.password && f.password === f.confirm;

  const detectState = async (setter) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const l = await Location.getCurrentPositionAsync({});
      const r = await Location.reverseGeocodeAsync({ latitude: l.coords.latitude, longitude: l.coords.longitude });
      if (r?.[0]?.region) setter(r[0].region);
    } catch (_) {}
  };

  /* ---------------- email/password ---------------- */
  const submit = async () => {
    if (mode === 'login') {
      if (!f.email || !f.password) return Alert.alert('Missing info', 'Enter your email and password.');
      setBusy(true);
      try { await login(f.email.trim(), f.password); navigation.goBack(); }
      catch (e) { Alert.alert('Sign in failed', e?.response?.data?.detail || 'Check your email and password and try again.'); }
      finally { setBusy(false); }
      return;
    }
    // signup
    if (!f.firstName || !f.email || !f.password) return Alert.alert('Missing info', 'First name, email and password are required.');
    if (!rulesOk) return Alert.alert('Weak password', 'Please meet all the password requirements.');
    if (!match) return Alert.alert('Passwords don’t match', 'Please confirm your password.');
    setBusy(true);
    try {
      const res = await signup({
        name: `${f.firstName.trim()} ${f.lastName.trim()}`.trim(),
        email: f.email.trim(),
        password: f.password,
        phone: fullPhone(f.phone),
        address: f.address.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        zip: f.zip.trim(),
      });
      if (res?.token) navigation.goBack();
      else { Alert.alert('Almost there', res?.message || 'Account created. Please sign in.'); setMode('login'); }
    } catch (e) { Alert.alert('Sign up failed', e?.response?.data?.detail || 'Could not create your account. Try again.'); }
    finally { setBusy(false); }
  };

  /* ---------------- Google ---------------- */
  const handleGoogle = async () => {
    if (gBusy) return;
    setGBusy(true);
    try {
      const redirectUrl = Linking.createURL('google-auth');
      const { data } = await api.auth.googleLogin(mode === 'signup' ? 'signup' : 'login', redirectUrl);
      if (!data?.auth_url) throw new Error('Google not configured');
      const result = await WebBrowser.openAuthSessionAsync(data.auth_url, redirectUrl);
      // Accept any result that carries a return URL (success on iOS; some Android
      // versions report 'dismiss' but still include the deep-link url).
      if (!result?.url) { setGBusy(false); return; }
      const queryParams = parseAuthParams(result.url);
      if (queryParams?.google_error) {
        Alert.alert('Google sign-in failed', String(queryParams.google_error));
      } else if (queryParams?.token) {
        await loginWithToken(String(queryParams.token));
        navigation.goBack();
      } else if (queryParams?.pending_id) {
        // NEW Google account — finish in-app (phone verification) instead of bouncing to the site.
        const pid = String(queryParams.pending_id);
        let prefill = { name: queryParams.name ? String(queryParams.name) : '', email: queryParams.email ? String(queryParams.email) : '' };
        try { const { data: p } = await api.auth.googlePending(pid); prefill = { name: p?.name || prefill.name, email: p?.email || prefill.email }; } catch (_) {}
        setGPending({ pending_id: pid, ...prefill });
        setG({ name: prefill.name || '', phone: '', state: '', address: '' });
        setGStep('info'); setGCode('');
      } else {
        Alert.alert('Google sign-in', 'Could not complete sign-in. Please try again.');
      }
    } catch (e) {
      Alert.alert('Google sign-in', e?.response?.data?.detail || 'Google sign-in is unavailable right now.');
    } finally { setGBusy(false); }
  };

  const gSendOtp = async () => {
    if (!g.name.trim()) return Alert.alert('Name required', 'Please enter your name.');
    if (cleanPhone(g.phone).length < 7) return Alert.alert('Phone required', 'Enter a valid phone number.');
    if (!g.state.trim()) return Alert.alert('State required', 'Please choose your state / region.');
    setGSending(true);
    try {
      await api.auth.googleOtpSend(gPending.pending_id, fullPhone(g.phone));
      setGStep('otp');
    } catch (e) { Alert.alert('Could not send code', e?.response?.data?.detail || 'Try again.'); }
    finally { setGSending(false); }
  };

  const gFinish = async () => {
    if (gCode.trim().length < 4) return Alert.alert('Enter the code', 'Type the verification code sent to your phone.');
    setGSending(true);
    try {
      await api.auth.googleOtpVerify(gPending.pending_id, fullPhone(g.phone), gCode.trim());
      const { data } = await api.auth.googleComplete({
        pending_id: gPending.pending_id,
        name: g.name.trim(),
        phone: fullPhone(g.phone),
        address: g.address.trim(),
        state: g.state.trim(),
      });
      if (data?.token) {
        await loginWithToken(data.token);
        setGPending(null);
        navigation.goBack();
      } else { Alert.alert('Almost there', 'Account created. Please sign in.'); setGPending(null); }
    } catch (e) { Alert.alert('Verification failed', e?.response?.data?.detail || 'Invalid or expired code. Try again.'); }
    finally { setGSending(false); }
  };

  const isLogin = mode === 'login';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="dark" />
      <LinearGradient colors={[colors.p50, '#ffffff', colors.s50]} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, { top: -70, right: -50, backgroundColor: colors.p200, opacity: 0.5 }]} />
      <View style={[styles.glow, { bottom: -90, left: -60, backgroundColor: colors.s200, opacity: 0.5 }]} />

      <TouchableOpacity style={[styles.close, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.brand}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandLogo}>
              <Ionicons name="storefront" size={26} color={colors.white} />
            </LinearGradient>
            <Text style={styles.brandText}><Text style={{ color: colors.primary }}>Open</Text><Text style={{ color: colors.secondary }}>Market</Text><Text style={{ color: colors.secondary, fontSize: 13 }}>lb</Text></Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.card}>
            <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create your account'}</Text>
            <Text style={styles.sub}>{isLogin ? 'Sign in to continue shopping' : 'Join the marketplace — it only takes a minute'}</Text>

            <View style={styles.tabs}>
              {['login', 'signup'].map((m) => (
                mode === m ? (
                  <LinearGradient key={m} colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabActive}><Text style={styles.tabActiveText}>{m === 'login' ? 'Sign in' : 'Register'}</Text></LinearGradient>
                ) : (
                  <TouchableOpacity key={m} style={styles.tab} onPress={() => setMode(m)}><Text style={styles.tabText}>{m === 'login' ? 'Sign in' : 'Register'}</Text></TouchableOpacity>
                )
              ))}
            </View>

            {isLogin ? (
              <>
                <Input icon="mail-outline" placeholder="Email address" value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: 12 }} />
                <Input icon="lock-closed-outline" placeholder="Password" value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry={!showPw} containerStyle={{ marginBottom: 6 }}
                  right={<TouchableOpacity onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} /></TouchableOpacity>} />
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><Input icon="person-outline" placeholder="First name" value={f.firstName} onChangeText={(v) => set('firstName', v)} containerStyle={{ marginBottom: 12 }} /></View>
                  <View style={{ flex: 1 }}><Input placeholder="Last name" value={f.lastName} onChangeText={(v) => set('lastName', v)} containerStyle={{ marginBottom: 12 }} /></View>
                </View>
                <Input icon="mail-outline" placeholder="Email address" value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: 12 }} />
                <Input icon="call-outline" prefix={CC} placeholder="Phone number" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" containerStyle={{ marginBottom: 12 }} />
                <Input icon="home-outline" placeholder="Street address" value={f.address} onChangeText={(v) => set('address', v)} containerStyle={{ marginBottom: 12 }} />
                <View style={styles.row}>
                  <View style={{ flex: 1.4 }}><Input icon="business-outline" placeholder="City" value={f.city} onChangeText={(v) => set('city', v)} containerStyle={{ marginBottom: 12 }} /></View>
                  <View style={{ flex: 1 }}><Input placeholder="ZIP" value={f.zip} onChangeText={(v) => set('zip', v)} keyboardType="number-pad" containerStyle={{ marginBottom: 12 }} /></View>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => { setStateQuery(''); setStateTarget('signup'); }} style={styles.stateField}>
                  <Ionicons name="location-outline" size={17} color={colors.textMuted} />
                  <Text style={[styles.stateVal, !f.state && { color: colors.textMuted }]} numberOfLines={1}>{f.state || 'State / region'}</Text>
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <Input icon="lock-closed-outline" placeholder="Password" value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry={!showPw} containerStyle={{ marginBottom: 12 }}
                  right={<TouchableOpacity onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} /></TouchableOpacity>} />
                <Input icon="lock-closed-outline" placeholder="Confirm password" value={f.confirm} onChangeText={(v) => set('confirm', v)} secureTextEntry={!showPw} containerStyle={{ marginBottom: 8 }}
                  right={f.confirm ? <Ionicons name={match ? 'checkmark-circle' : 'close-circle'} size={18} color={match ? colors.seller : colors.sale} /> : null} />
                {f.password.length > 0 && (
                  <View style={styles.checklist}>
                    {RULES.map((r) => { const ok = r.test(f.password); return (
                      <View key={r.key} style={styles.ruleRow}><Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ok ? colors.seller : colors.textMuted} /><Text style={[styles.ruleText, ok && { color: colors.sellerSoftText }]}>{r.label}</Text></View>
                    ); })}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity activeOpacity={0.9} onPress={submit} disabled={busy} style={{ marginTop: 16 }}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.submit, shadow.violetGlow]}>
                {busy ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.submitText}>{isLogin ? 'Sign in' : 'Create account'}</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>or</Text><View style={styles.dividerLine} /></View>
            <TouchableOpacity style={styles.google} activeOpacity={0.7} onPress={handleGoogle} disabled={gBusy}>
              {gBusy ? <ActivityIndicator size="small" color="#5f6368" /> : <View style={styles.gIcon}><GoogleLogo size={19} /></View>}
              <Text style={styles.googleText}>{gBusy ? 'Connecting…' : `${isLogin ? 'Sign in' : 'Sign up'} with Google`}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMode(isLogin ? 'signup' : 'login')} style={{ marginTop: 16 }}>
              <Text style={styles.switch}>{isLogin ? "Don't have an account? " : 'Already have an account? '}<Text style={styles.switchLink}>{isLogin ? 'Register' : 'Sign in'}</Text></Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Google new-account completion */}
      <BottomSheet visible={!!gPending} onClose={() => setGPending(null)} maxHeight="88%">
        {gStep === 'info' ? (
          <>
            <Text style={styles.sheetTitle}>Finish signing up</Text>
            <Text style={styles.sheetSub}>{gPending?.email ? `Signed in as ${gPending.email}. ` : ''}Add a few details to secure your account.</Text>
            <Input icon="person-outline" placeholder="Full name" value={g.name} onChangeText={(v) => setG((p) => ({ ...p, name: v }))} containerStyle={{ marginBottom: 12, marginTop: 12 }} />
            <Input icon="call-outline" prefix={CC} placeholder="Phone number" value={g.phone} onChangeText={(v) => setG((p) => ({ ...p, phone: v }))} keyboardType="phone-pad" containerStyle={{ marginBottom: 12 }} />
            <TouchableOpacity activeOpacity={0.8} onPress={() => { setStateQuery(''); setStateTarget('google'); }} style={styles.stateField}>
              <Ionicons name="location-outline" size={17} color={colors.textMuted} />
              <Text style={[styles.stateVal, !g.state && { color: colors.textMuted }]} numberOfLines={1}>{g.state || 'State / region'}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <Input icon="home-outline" placeholder="Street address (optional)" value={g.address} onChangeText={(v) => setG((p) => ({ ...p, address: v }))} containerStyle={{ marginBottom: 4 }} />
            <TouchableOpacity activeOpacity={0.9} onPress={gSendOtp} disabled={gSending} style={{ marginTop: 14 }}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                {gSending ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="shield-checkmark" size={17} color={colors.white} /><Text style={styles.submitText}>Send verification code</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Verify your phone</Text>
            <Text style={styles.sheetSub}>Enter the code sent to {fullPhone(g.phone)}.</Text>
            <Input icon="keypad-outline" placeholder="6-digit code" value={gCode} onChangeText={setGCode} keyboardType="number-pad" maxLength={6} containerStyle={{ marginBottom: 4, marginTop: 12 }} />
            <TouchableOpacity onPress={gSendOtp} disabled={gSending}><Text style={styles.resend}>Didn’t get it? Resend code</Text></TouchableOpacity>
            <TouchableOpacity activeOpacity={0.9} onPress={gFinish} disabled={gSending} style={{ marginTop: 12 }}>
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                {gSending ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.submitText}>Verify & finish</Text><Ionicons name="arrow-forward" size={17} color={colors.white} /></>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* State picker — states are chosen from a list, not typed */}
      <BottomSheet visible={!!stateTarget} onClose={() => setStateTarget(null)} maxHeight="80%">
        <Text style={styles.sheetTitle}>Select your state</Text>
        <Input icon="search" placeholder="Search states…" value={stateQuery} onChangeText={setStateQuery} autoCapitalize="none" containerStyle={{ marginTop: 12, marginBottom: 6 }} />
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {states.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase())).map((s) => {
            const cur = stateTarget === 'signup' ? f.state : g.state;
            return (
              <TouchableOpacity key={s} style={styles.stateOpt} onPress={() => { if (stateTarget === 'signup') set('state', s); else setG((p) => ({ ...p, state: s })); setStateTarget(null); }}>
                <Text style={[styles.stateOptText, cur === s && { color: colors.primary, fontFamily: fonts.bold }]}>{s}</Text>
                {cur === s ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
          {states.length === 0 ? <Text style={styles.stateNone}>Loading states…</Text> : null}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 999 },
  close: { position: 'absolute', right: 16, zIndex: 10, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  brand: { alignItems: 'center', marginBottom: 18 },
  brandLogo: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  brandText: { fontFamily: fonts.extrabold, fontSize: 22, marginTop: 12, letterSpacing: -0.5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, borderWidth: 1, borderColor: colors.borderLight, ...shadow.emphasis },
  title: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.ink, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 18 },
  tabs: { flexDirection: 'row', backgroundColor: colors.bgAlt, borderRadius: radius.pill, padding: 4, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  tabActive: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  tabActiveText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  row: { flexDirection: 'row', gap: 10 },
  checklist: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12, gap: 7, marginBottom: 4, marginTop: 4 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md },
  submitText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, height: 50, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong || colors.border, ...shadow.card },
  gIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  googleText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  switch: { textAlign: 'center', fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  switchLink: { fontFamily: fonts.bold, color: colors.primary },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  resend: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.primary, marginTop: 10, textAlign: 'center' },
  stateField: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 11, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 12 },
  stateVal: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.ink },
  stateOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  stateOptText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  stateNone: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
