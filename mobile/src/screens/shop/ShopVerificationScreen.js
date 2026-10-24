import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { pickImage, captureImage } from '../../lib/imagePick';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { tapLight, tapMedium, notifySuccess, notifyError } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Pulse, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import { BouncyPin, GpsButton, reverseGeocode } from './ShopLocationScreen';

const STEPS = [
  { id: 'email', label: 'Email Verification', icon: 'mail' },
  { id: 'location', label: 'Shop Location', icon: 'location' },
  { id: 'document', label: 'Document Upload', icon: 'document-text' },
];

/* self-drawing connector line between step circles */
function ProgressLine({ complete }) {
  const a = useRef(new Animated.Value(complete ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: complete ? 1 : 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [complete, a]);
  return (
    <View style={pl.track}>
      <Animated.View style={[pl.fill, { width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}
const pl = StyleSheet.create({
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border, marginHorizontal: 6, marginBottom: 20, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: '#34d399' },
});

/* six code boxes — shake on error, flip green on success */
function CodeBoxes({ code, onChange, error, success }) {
  const inputRef = useRef(null);
  const shake = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (error) {
      notifyError();
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -0.6, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shake]);
  useEffect(() => {
    if (success) {
      Animated.timing(flip, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [success, flip]);
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
      <Animated.View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }] }}>
        {Array.from({ length: 6 }, (_, i) => {
          const ch = code[i] || '';
          const filled = !!ch;
          return (
            <Animated.View key={i} style={[cb.box,
              filled && { borderColor: colors.p450 },
              success && { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
              error && { borderColor: '#f87171' },
              success && { transform: [{ rotateX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] }) }] },
            ]}>
              <Text style={[cb.char, success && { color: '#059669' }]}>{ch}</Text>
            </Animated.View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={cb.hidden}
        testID="email-code-input"
        autoFocus
      />
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  box: { width: 44, height: 52, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  char: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 52, width: '100%' },
});

/* scan-line sweep while a document is uploading */
function ScanLine() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(a, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start();
  }, [a]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: radius.md }]}>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, height: 44,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-44, 190] }) }],
      }}>
        <LinearGradient colors={['transparent', 'rgba(139,92,246,0.35)', 'transparent']} style={{ flex: 1 }} />
        <View style={{ position: 'absolute', top: 20, left: 8, right: 8, height: 2, backgroundColor: colors.p450, borderRadius: 1, opacity: 0.8 }} />
      </Animated.View>
    </View>
  );
}

/* document upload card — upload / camera / preview / delete */
function DocumentUploadCard({ label, docType, docUrl, uploading, onUpload, onDelete }) {
  const pick = async (fromCamera) => {
    let res;
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { toast.error('Camera access needed'); return; }
      res = await captureImage({ quality: 0.8 });
    } else {
      res = await pickImage({ mediaTypes: ['images'], quality: 0.8 });
    }
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    onUpload({ uri: asset.uri, name: asset.fileName || `${docType}.jpg`, mimeType: asset.mimeType }, docType);
  };
  return (
    <View style={dc.card} testID={`doc-upload-${docType}`}>
      {docUrl ? (
        <View>
          <Image source={{ uri: img(docUrl) }} style={dc.preview} resizeMode="contain" />
          <TouchableOpacity onPress={() => onDelete(docType)} style={dc.delete} testID={`doc-delete-${docType}`}>
            <Ionicons name="close" size={13} color={colors.white} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 }}>
            <Ionicons name="checkmark-circle" size={12} color="#059669" />
            <Text style={dc.uploaded}>{label} uploaded</Text>
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 9, position: 'relative' }}>
          {uploading && <ScanLine />}
          <View style={dc.icon}><Ionicons name="document-text" size={22} color={colors.textMuted} /></View>
          <Text style={dc.label}>{label}</Text>
          {uploading ? (
            <Spinner size={20} color={colors.p450} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => pick(false)} style={[dc.btn, { backgroundColor: colors.p100 }]} testID={`doc-upload-file-${docType}`}>
                <Ionicons name="cloud-upload" size={12} color={colors.p800} />
                <Text style={[dc.btnText, { color: colors.p800 }]}>Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => pick(true)} style={[dc.btn, { backgroundColor: '#dbeafe' }]} testID={`doc-camera-${docType}`}>
                <Ionicons name="camera" size={12} color="#1d4ed8" />
                <Text style={[dc.btnText, { color: '#1d4ed8' }]}>Camera</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={dc.hint}>JPG, PNG, WEBP (max 5MB)</Text>
        </View>
      )}
    </View>
  );
}
const dc = StyleSheet.create({
  card: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.lg, padding: 14, minHeight: 172, justifyContent: 'center' },
  preview: { width: '100%', height: 130, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  delete: { position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  uploaded: { fontFamily: fonts.semibold, fontSize: 11, color: '#059669' },
  icon: { width: 46, height: 46, borderRadius: 13, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.md, paddingHorizontal: 11, paddingVertical: 8 },
  btnText: { fontFamily: fonts.bold, fontSize: 11 },
  hint: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
});

/* verified badge that stamps down with a haptic thud */
function StampBadge() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(250),
      Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => tapMedium());
  }, [a]);
  return (
    <Animated.View style={{
      opacity: a,
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }],
    }}>
      <LinearGradient colors={['#34d399', '#14b8a6']} style={es.bigIcon}>
        <Ionicons name="shield-checkmark" size={46} color={colors.white} />
      </LinearGradient>
    </Animated.View>
  );
}
/* breathing amber clock for the pending state */
function Breathing({ children }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [a]);
  return <Animated.View style={{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }}>{children}</Animated.View>;
}

const MAP_MODES = [
  { key: 'openstreetmap', name: 'Street', mapType: 'standard' },
  { key: 'google_roadmap', name: 'Google', mapType: Platform.OS === 'ios' ? 'mutedStandard' : 'standard' },
];

export default function ShopVerificationScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // email step
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [codeError, setCodeError] = useState(0);
  const [codeSuccess, setCodeSuccess] = useState(false);

  // location step
  const [latitude, setLatitude] = useState(33.8938);
  const [longitude, setLongitude] = useState(35.5018);
  const [locationAddress, setLocationAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapProvider, setMapProvider] = useState('openstreetmap');
  const [bounceKey, setBounceKey] = useState(0);
  const mapRef = useRef(null);

  // document step
  const [docType, setDocType] = useState('id');
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await api.shop.getVerificationStatus();
      setStatus(data);
      if (data.documents) setDocuments(data.documents);
      if (data.document_type) setDocType(data.document_type);
      // determine current step — ported verbatim
      if (data.is_verified) setCurrentStep(3);
      else if (data.document_uploaded) setCurrentStep(2);
      else if (data.location_set) setCurrentStep(data.email_verified ? 2 : 0);
      else if (data.email_verified) setCurrentStep(1);
    } catch (err) {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // load saved location when entering the location step
  useEffect(() => {
    if (!loading && currentStep === 1) {
      api.shop.getLocation().then(({ data }) => {
        if (data.latitude && data.longitude) {
          setLatitude(data.latitude); setLongitude(data.longitude);
          setLocationAddress(data.location_address || '');
        }
      }).catch(() => {});
    }
  }, [loading, currentStep]);

  /* ===== email ===== */
  const handleSendEmailCode = async () => {
    setEmailSending(true);
    try {
      const { data } = await api.shop.sendVerificationEmail();
      setEmailSent(true);
      if (data.dev_code) setDevCode(data.dev_code);
      toast.success('Verification code sent!');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send code'); }
    finally { setEmailSending(false); }
  };

  const handleVerifyEmail = async () => {
    if (!emailCode || emailCode.length !== 6) { toast.error('Enter valid 6-digit code'); setCodeError(k => k + 1); return; }
    setVerifyingEmail(true);
    try {
      await api.shop.verifyEmail(emailCode);
      setCodeSuccess(true);
      notifySuccess();
      toast.success('Email verified!');
      setStatus(prev => ({ ...prev, email_verified: true }));
      setTimeout(() => setCurrentStep(1), 800);
    } catch (err) {
      setCodeError(k => k + 1);
      toast.error(err.response?.data?.detail || 'Invalid code');
    } finally { setVerifyingEmail(false); }
  };

  /* ===== location ===== */
  const moveTo = (lat, lng) => mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
  const setPoint = async (lat, lng) => {
    setLatitude(lat); setLongitude(lng); setLocationSaved(false);
    setBounceKey(k => k + 1); tapLight();
    const address = await reverseGeocode(lat, lng);
    if (address) setLocationAddress(address);
  };
  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        setLatitude(parseFloat(lat)); setLongitude(parseFloat(lon));
        setLocationAddress(display_name); setLocationSaved(false);
        setBounceKey(k => k + 1);
        moveTo(parseFloat(lat), parseFloat(lon));
      } else toast.error('Location not found');
    } catch { toast.error('Search failed'); }
  };
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') { toast.error('Unable to get location'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await setPoint(loc.coords.latitude, loc.coords.longitude);
      moveTo(loc.coords.latitude, loc.coords.longitude);
      toast.success('Location updated!');
    } catch { toast.error('Unable to get location'); }
    finally { setLocating(false); }
  };
  const handleSaveLocation = async () => {
    setSaving(true);
    try {
      await api.shop.updateLocation({ latitude, longitude, location_address: locationAddress });
      setLocationSaved(true);
      setStatus(prev => ({ ...prev, location_set: true }));
      notifySuccess();
      toast.success('Location saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  /* ===== documents ===== */
  const handleDocUpload = async (file, type) => {
    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const { data } = await api.shop.uploadVerificationDocument(file, type);
      setDocuments(prev => ({ ...prev, [type]: data.document_url }));
      setStatus(prev => ({ ...prev, document_uploaded: true }));
      toast.success('Document uploaded!');
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(prev => ({ ...prev, [type]: false })); }
  };
  const handleDocDelete = async (type) => {
    try {
      await api.shop.deleteVerificationDocument(type);
      setDocuments(prev => { const n = { ...prev }; delete n[type]; return n; });
      const remaining = Object.keys(documents).filter(k => k !== type);
      if (remaining.length === 0) setStatus(prev => ({ ...prev, document_uploaded: false }));
      toast.success('Document removed');
    } catch (err) { toast.error('Failed to remove'); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.shop.submitVerification();
      notifySuccess();
      toast.success('Verification submitted for review!');
      setStatus(prev => ({ ...prev, verification_status: 'pending' }));
    } catch (err) { toast.error(err.response?.data?.detail || 'Submission failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return <View style={es.center}><Spinner size={34} color={colors.p450} /></View>;
  }

  /* ===== end states ===== */
  if (status?.is_verified) {
    return (
      <ShopScreenWrap testID="verification-complete">
        <View style={es.endWrap}>
          <StampBadge />
          <Text style={es.endTitle}>Verified Seller</Text>
          <Text style={es.endSub}>Your shop is verified. You have higher ranking and a verified badge.</Text>
          <View style={es.verifiedPill}>
            <Ionicons name="shield-checkmark" size={16} color="#059669" />
            <Text style={es.verifiedPillText}>Verified Seller</Text>
          </View>
        </View>
      </ShopScreenWrap>
    );
  }
  if (status?.verification_status === 'pending') {
    return (
      <ShopScreenWrap testID="verification-pending">
        <View style={es.endWrap}>
          <Breathing>
            <LinearGradient colors={['#fbbf24', '#f97316']} style={es.bigIcon}>
              <Pulse><Ionicons name="time" size={46} color={colors.white} /></Pulse>
            </LinearGradient>
          </Breathing>
          <Text style={es.endTitle}>Under Review</Text>
          <Text style={es.endSub}>Your verification is being reviewed by our team.</Text>
          <Text style={es.endNote}>Usually takes 1-2 business days.</Text>
        </View>
      </ShopScreenWrap>
    );
  }
  if (status?.verification_status === 'rejected') {
    return (
      <ShopScreenWrap testID="verification-rejected">
        <View style={es.endWrap}>
          <LinearGradient colors={['#f87171', '#f43f5e']} style={es.bigIcon}>
            <Ionicons name="close-circle" size={46} color={colors.white} />
          </LinearGradient>
          <Text style={es.endTitle}>Verification Rejected</Text>
          <Text style={es.endSub}>Your verification was not approved.</Text>
          {status.rejection_reason ? (
            <View style={es.reasonBox}><Text style={es.reasonText}>Reason: {status.rejection_reason}</Text></View>
          ) : null}
          <PressScale onPress={() => { setStatus(prev => ({ ...prev, verification_status: 'in_progress' })); setCurrentStep(0); }} style={{ marginTop: 18 }}>
            <View style={es.tryAgain}><Text style={es.tryAgainText}>Try Again</Text></View>
          </PressScale>
        </View>
      </ShopScreenWrap>
    );
  }

  const isStepComplete = (idx) => {
    if (idx === 0) return status?.email_verified;
    if (idx === 1) return status?.location_set;
    if (idx === 2) return status?.document_uploaded;
    return false;
  };
  const isDocComplete = () => {
    if (docType === 'id') return documents.id_front && documents.id_back;
    return !!documents.passport;
  };
  const allStepsComplete = status?.email_verified && status?.location_set && isDocComplete();
  const mode = MAP_MODES.find(m => m.key === mapProvider) || MAP_MODES[0];

  return (
    <ShopScreenWrap testID="shop-verification-page">
      {/* Header */}
      <Rise duration={500} distance={0}>
        <View style={{ alignItems: 'center' }}>
          <LinearGradient colors={[colors.p500, colors.s500]} style={es.headIcon}><Ionicons name="shield-checkmark" size={28} color={colors.white} /></LinearGradient>
          <Text style={es.headTitle}>Shop Verification</Text>
          <Text style={es.headSub}>Complete 3 steps to get your verified seller badge</Text>
          <Text style={es.headTime}>Takes 3-5 minutes</Text>
        </View>
      </Rise>

      {/* Progress steps + self-drawing lines */}
      <Rise delay={100}>
        <View style={es.stepsRow} testID="verification-steps-progress">
          {STEPS.map((step, idx) => {
            const complete = isStepComplete(idx);
            const active = currentStep === idx;
            return (
              <React.Fragment key={step.id}>
                <TouchableOpacity onPress={() => setCurrentStep(idx)} activeOpacity={0.8} style={{ alignItems: 'center', gap: 6 }} testID={`step-indicator-${step.id}`}>
                  {complete ? (
                    <LinearGradient colors={['#34d399', '#14b8a6']} style={[es.stepCircle, shop.emeraldGlow]}>
                      <Ionicons name="checkmark" size={20} color={colors.white} />
                    </LinearGradient>
                  ) : active ? (
                    <LinearGradient colors={[colors.p450, colors.s500]} style={[es.stepCircle, { transform: [{ scale: 1.1 }] }, shadow.violetGlow]}>
                      <Ionicons name={step.icon} size={19} color={colors.white} />
                    </LinearGradient>
                  ) : (
                    <View style={[es.stepCircle, { backgroundColor: colors.borderLight, borderWidth: 2, borderColor: colors.border }]}>
                      <Ionicons name={step.icon} size={18} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={[es.stepLabel, { color: complete ? '#059669' : active ? colors.p800 : colors.textMuted }]}>{step.label}</Text>
                </TouchableOpacity>
                {idx < STEPS.length - 1 && <ProgressLine complete={isStepComplete(idx)} />}
              </React.Fragment>
            );
          })}
        </View>
      </Rise>

      {/* Step content card */}
      <Rise delay={160}>
        <View style={es.card}>
          {/* ====== Step 1: Email ====== */}
          {currentStep === 0 && (
            <View style={{ gap: 16 }} testID="step-email-content">
              <View style={{ alignItems: 'center' }}>
                <View style={[es.stepIconSoft, { backgroundColor: '#eff6ff' }]}><Ionicons name="mail" size={24} color="#2563eb" /></View>
                <Text style={es.stepTitle}>Verify Your Email</Text>
                <Text style={es.stepDesc}>We'll send a 6-digit code to your registered email</Text>
              </View>

              {status?.email_verified ? (
                <View style={es.doneBox}>
                  <Ionicons name="checkmark-circle" size={22} color="#059669" />
                  <View>
                    <Text style={es.doneTitle}>Email Verified</Text>
                    <Text style={es.doneDesc}>Your email has been verified successfully</Text>
                  </View>
                </View>
              ) : !emailSent ? (
                <PressScale onPress={handleSendEmailCode} disabled={emailSending}>
                  <LinearGradient colors={['#2563eb', colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={es.bigBtn} testID="send-email-code-btn">
                    {emailSending ? <Spinner size={16} /> : <Ionicons name="mail" size={16} color={colors.white} />}
                    <Text style={es.bigBtnText}>Send Verification Code</Text>
                  </LinearGradient>
                </PressScale>
              ) : (
                <View style={{ gap: 14 }}>
                  {devCode ? (
                    <View style={es.devBox}><Text style={es.devText}>Dev Mode - Your code: <Text style={{ fontFamily: fonts.extrabold, fontSize: 15 }}>{devCode}</Text></Text></View>
                  ) : null}
                  <Text style={es.codeLabel}>Enter 6-digit code</Text>
                  <CodeBoxes code={emailCode} onChange={setEmailCode} error={codeError} success={codeSuccess} />
                  <PressScale onPress={handleVerifyEmail} disabled={verifyingEmail || emailCode.length !== 6}>
                    <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[es.bigBtn, (verifyingEmail || emailCode.length !== 6) && { opacity: 0.55 }]} testID="verify-email-btn">
                      {verifyingEmail ? <Spinner size={16} /> : <Ionicons name="checkmark-circle" size={16} color={colors.white} />}
                      <Text style={es.bigBtnText}>Verify Email</Text>
                    </LinearGradient>
                  </PressScale>
                  <TouchableOpacity onPress={handleSendEmailCode}>
                    <Text style={es.resend}>Resend code</Text>
                  </TouchableOpacity>
                </View>
              )}

              {status?.email_verified && (
                <PressScale onPress={() => setCurrentStep(1)}>
                  <View style={es.nextBtn} testID="next-to-location-btn">
                    <Text style={es.nextText}>Next: Shop Location</Text>
                    <Ionicons name="arrow-forward" size={15} color={colors.text} />
                  </View>
                </PressScale>
              )}
            </View>
          )}

          {/* ====== Step 2: Location ====== */}
          {currentStep === 1 && (
            <View style={{ gap: 12 }} testID="step-location-content">
              <View style={{ alignItems: 'center' }}>
                <View style={[es.stepIconSoft, { backgroundColor: '#f0fdf4' }]}><Ionicons name="location" size={24} color="#16a34a" /></View>
                <Text style={es.stepTitle}>Shop Location</Text>
                <Text style={es.stepDesc}>Set your shop location so customers can find you</Text>
              </View>

              {status?.location_set && !locationSaved && (
                <View style={[es.doneBox, { paddingVertical: 10 }]}>
                  <Ionicons name="checkmark-circle" size={17} color="#059669" />
                  <Text style={[es.doneDesc, { flex: 1 }]}>Location already set. You can update it below if needed.</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 7 }}>
                <View style={es.search}>
                  <Ionicons name="search" size={14} color={colors.textMuted} />
                  <TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleLocationSearch}
                    placeholder="Search address..." placeholderTextColor={colors.textMuted} style={es.searchInput} testID="verification-location-search" />
                </View>
                <TouchableOpacity onPress={handleLocationSearch} style={es.iconBtn}><Ionicons name="search" size={15} color={colors.textSecondary} /></TouchableOpacity>
                <GpsButton locating={locating} onPress={handleUseCurrentLocation} testID="verification-use-location-btn" />
              </View>

              <View style={es.providerToggle}>
                {MAP_MODES.map(m => (
                  <TouchableOpacity key={m.key} onPress={() => setMapProvider(m.key)}
                    style={[es.providerBtn, mapProvider === m.key && es.providerBtnOn]}>
                    <Text style={[es.providerText, mapProvider === m.key && { color: colors.p800 }]}>{m.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={es.mapWrap} testID="verification-map">
                <MapView
                  ref={mapRef}
                  style={{ height: 250 }}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  mapType={mode.mapType}
                  initialRegion={{ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                  onPress={(e) => { const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate; setPoint(lat, lng); }}
                >
                  <Marker coordinate={{ latitude, longitude }} draggable anchor={{ x: 0.5, y: 1 }}
                    onDragEnd={(e) => { const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate; setPoint(lat, lng); }}>
                    <BouncyPin bounceKey={bounceKey} />
                  </Marker>
                </MapView>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={es.tinyLabel}>Latitude</Text>
                  <View style={es.readonly}><Text style={es.readonlyText}>{latitude.toFixed(6)}</Text></View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={es.tinyLabel}>Longitude</Text>
                  <View style={es.readonly}><Text style={es.readonlyText}>{longitude.toFixed(6)}</Text></View>
                </View>
              </View>
              <View>
                <Text style={es.tinyLabel}>Address</Text>
                <TextInput value={locationAddress} onChangeText={(t) => { setLocationAddress(t); setLocationSaved(false); }}
                  placeholder="Shop address..." placeholderTextColor={colors.textMuted} style={es.input} testID="verification-address-input" />
              </View>

              <PressScale onPress={handleSaveLocation} disabled={saving}>
                <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={es.bigBtn} testID="verification-save-location-btn">
                  {saving ? <Spinner size={15} /> : <Ionicons name={locationSaved ? 'checkmark-circle' : 'save'} size={15} color={colors.white} />}
                  <Text style={es.bigBtnText}>{locationSaved ? 'Location Saved!' : 'Save Location'}</Text>
                </LinearGradient>
              </PressScale>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <PressScale style={{ flex: 1 }} onPress={() => setCurrentStep(0)}>
                  <View style={es.nextBtn}><Ionicons name="arrow-back" size={14} color={colors.text} /><Text style={es.nextText}>Back</Text></View>
                </PressScale>
                {(status?.location_set || locationSaved) && (
                  <PressScale style={{ flex: 1 }} onPress={() => setCurrentStep(2)}>
                    <View style={es.nextBtn} testID="next-to-document-btn">
                      <Text style={es.nextText}>Next: Document</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.text} />
                    </View>
                  </PressScale>
                )}
              </View>
            </View>
          )}

          {/* ====== Step 3: Documents ====== */}
          {currentStep === 2 && (
            <View style={{ gap: 16 }} testID="step-document-content">
              <View style={{ alignItems: 'center' }}>
                <View style={[es.stepIconSoft, { backgroundColor: colors.p50 }]}><Ionicons name="document-text" size={24} color={colors.p600} /></View>
                <Text style={es.stepTitle}>Upload Document</Text>
                <Text style={es.stepDesc}>Upload your ID card or Passport for identity verification</Text>
              </View>

              {/* Doc type selector */}
              <View style={{ flexDirection: 'row', gap: 10 }} testID="doc-type-selector">
                <TouchableOpacity onPress={() => setDocType('id')} activeOpacity={0.85}
                  style={[es.docType, docType === 'id' && { borderColor: colors.p450, backgroundColor: colors.p50, ...shadow.card }]} testID="doc-type-id">
                  <Ionicons name="card" size={26} color={docType === 'id' ? colors.p500 : colors.textMuted} />
                  <Text style={[es.docTypeName, docType === 'id' && { color: colors.p800 }]}>ID Card</Text>
                  <Text style={es.docTypeHint}>Front & Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDocType('passport')} activeOpacity={0.85}
                  style={[es.docType, docType === 'passport' && { borderColor: colors.p450, backgroundColor: colors.p50, ...shadow.card }]} testID="doc-type-passport">
                  <Ionicons name="book" size={26} color={docType === 'passport' ? colors.p500 : colors.textMuted} />
                  <Text style={[es.docTypeName, docType === 'passport' && { color: colors.p800 }]}>Passport</Text>
                  <Text style={es.docTypeHint}>One photo</Text>
                </TouchableOpacity>
              </View>

              {docType === 'id' ? (
                <View style={{ gap: 10 }} testID="id-upload-section">
                  <DocumentUploadCard label="Front of ID" docType="id_front" docUrl={documents.id_front}
                    uploading={uploading.id_front} onUpload={handleDocUpload} onDelete={handleDocDelete} />
                  <DocumentUploadCard label="Back of ID" docType="id_back" docUrl={documents.id_back}
                    uploading={uploading.id_back} onUpload={handleDocUpload} onDelete={handleDocDelete} />
                </View>
              ) : (
                <View testID="passport-upload-section">
                  <DocumentUploadCard label="Passport Photo" docType="passport" docUrl={documents.passport}
                    uploading={uploading.passport} onUpload={handleDocUpload} onDelete={handleDocDelete} />
                </View>
              )}

              <PressScale onPress={() => setCurrentStep(1)}>
                <View style={es.nextBtn}><Ionicons name="arrow-back" size={14} color={colors.text} /><Text style={es.nextText}>Back</Text></View>
              </PressScale>

              {allStepsComplete && status?.verification_status !== 'pending' && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 16 }}>
                  <PressScale onPress={handleSubmit} disabled={submitting}>
                    <LinearGradient colors={[colors.p500, colors.p600, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[es.bigBtn, { height: 54 }, shadow.violetGlow]} testID="submit-verification-btn">
                      {submitting ? <Spinner size={17} /> : <Ionicons name="shield-checkmark" size={17} color={colors.white} />}
                      <Text style={[es.bigBtnText, { fontSize: 15.5 }]}>Submit for Verification</Text>
                    </LinearGradient>
                  </PressScale>
                  <Text style={es.submitNote}>Your request will be reviewed within 1-2 business days</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Rise>
    </ShopScreenWrap>
  );
}

const es = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...shadow.violetGlow },
  headTitle: { fontFamily: fonts.heading, fontSize: 23, color: colors.ink, letterSpacing: -0.4 },
  headSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  headTime: { fontFamily: fonts.semibold, fontSize: 11, color: colors.p500, marginTop: 3 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  stepCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: fonts.bold, fontSize: 9 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: 18, marginTop: 22, ...shadow.emphasis },
  stepIconSoft: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  stepTitle: { fontFamily: fonts.extrabold, fontSize: 18.5, color: colors.ink },
  stepDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  doneBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.md, padding: 13 },
  doneTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: '#065f46' },
  doneDesc: { fontFamily: fonts.body, fontSize: 11.5, color: '#059669', marginTop: 1 },
  bigBtn: { height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bigBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  devBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.md, padding: 11 },
  devText: { fontFamily: fonts.medium, fontSize: 11.5, color: '#92400e' },
  codeLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  resend: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.p500, textAlign: 'center' },
  nextBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  nextText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 11 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 12.5, color: colors.text },
  iconBtn: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  providerToggle: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: colors.bgAlt, borderRadius: radius.pill, padding: 3, gap: 2 },
  providerBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  providerBtnOn: { backgroundColor: colors.white, ...shadow.card },
  providerText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textMuted },
  mapWrap: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, ...shadow.card },
  tinyLabel: { fontFamily: fonts.medium, fontSize: 10, color: colors.textMuted, marginBottom: 4 },
  readonly: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  readonlyText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 9, fontFamily: fonts.body, fontSize: 12.5, color: colors.text },
  docType: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 16 },
  docTypeName: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.textSecondary },
  docTypeHint: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  submitNote: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  endWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  bigIcon: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...shadow.emphasis },
  endTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
  endSub: { fontFamily: fonts.body, fontSize: 14.5, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  endNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 8 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 9, marginTop: 20 },
  verifiedPillText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#047857' },
  reasonBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 14, marginTop: 14 },
  reasonText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#b91c1c' },
  tryAgain: { backgroundColor: colors.p500, borderRadius: radius.md, paddingHorizontal: 26, paddingVertical: 13 },
  tryAgainText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13.5 },
});
