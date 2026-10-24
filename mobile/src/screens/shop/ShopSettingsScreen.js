import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Image, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { pickImage } from '../../lib/imagePick';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../../lib/api';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { tapLight, notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { Input } from '../../components/ui';
import { ShopScreenWrap, Rise, PressScale, Spinner, toast } from '../../components/shop/ShopKit';

/* single image uploader with an URL input option (branding logo/cover) */
function BrandImagePicker({ label, hint, value, onChange, wide }) {
  const [busy, setBusy] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const pick = async () => {
    // Crop on pick: cover (wide) = rectangular 16:9, logo = square 1:1.
    const res = await pickImage({ mediaTypes: ['images'], allowsEditing: true, aspect: wide ? [16, 9] : [1, 1] });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
    setBusy(true);
    try {
      const resp = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || 'image.jpg', mimeType: asset.mimeType });
      onChange(`${MEDIA_BASE_URL}${resp.data.url}`);
    } catch { toast.error('Upload failed'); }
    finally { setBusy(false); }
  };
  return (
    <View style={bi.card}>
      <Text style={bi.label}>{label}</Text>
      <TouchableOpacity onPress={pick} activeOpacity={0.8} style={[bi.box, wide ? { height: 110 } : { height: 130 }]}>
        {busy ? <Spinner size={18} color={colors.textMuted} /> : value ? (
          <>
            <Image source={{ uri: img(value) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <TouchableOpacity onPress={() => onChange('')} style={bi.remove}><Ionicons name="close" size={12} color={colors.white} /></TouchableOpacity>
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
            <Text style={bi.boxText}>Tap to upload</Text>
          </>
        )}
      </TouchableOpacity>
      {urlMode ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <TextInput value={urlValue} onChangeText={setUrlValue} placeholder="https://..." autoCapitalize="none"
            placeholderTextColor={colors.textMuted} style={[bi.urlInput, { flex: 1 }]} />
          <TouchableOpacity onPress={() => { if (urlValue.trim()) { onChange(urlValue.trim()); setUrlMode(false); setUrlValue(''); } }} style={bi.urlSave}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setUrlMode(true)}><Text style={bi.urlLink}>Use image URL instead</Text></TouchableOpacity>
      )}
      {hint ? <Text style={bi.hint}>{hint}</Text> : null}
    </View>
  );
}
const bi = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, backgroundColor: 'rgba(248,250,252,0.5)' },
  label: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text, marginBottom: 8 },
  box: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden', backgroundColor: colors.surface },
  boxText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  remove: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(15,23,42,0.65)', borderRadius: radius.pill, padding: 5 },
  urlLink: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.p500, marginTop: 8 },
  urlInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 7, fontFamily: fonts.body, fontSize: 11.5, color: colors.text, backgroundColor: colors.surface },
  urlSave: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.p500, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, marginTop: 6 },
});

/* section shell: gradient icon tile + title + testID */
function Section({ icon, grad, title, sub, children, right, onLayout, testID }) {
  return (
    <View style={sec.card} onLayout={onLayout} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <LinearGradient colors={grad} style={sec.tile}><Ionicons name={icon} size={17} color={colors.white} /></LinearGradient>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Text style={sec.title}>{title}</Text>
          <Text style={sec.sub}>{sub}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}
const sec = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 16, marginTop: 14, ...shadow.card },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  title: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
});

export default function ShopSettingsScreen({ navigation }) {
  const [shopData, setShopData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', phone: '', email: '', address: '', logo: '', banner: '' });

  // gallery
  const [gallery, setGallery] = useState([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [editingSaving, setEditingSaving] = useState(false);

  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const shake = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [shopRes, subRes] = await Promise.all([api.shop.getProfile(), api.shop.getSubscription()]);
      setShopData(shopRes.data);
      setSubscription(subRes.data);
      setFormData({
        name: shopRes.data.name || '',
        description: shopRes.data.description || '',
        phone: shopRes.data.phone || '',
        email: shopRes.data.email || '',
        address: shopRes.data.address || '',
        logo: shopRes.data.logo || '',
        banner: shopRes.data.banner || '',
      });
    } catch (error) {} finally { setLoading(false); }
  }, []);
  const fetchGallery = useCallback(async () => {
    try { const { data } = await api.shop.getGallery(); setGallery(data.gallery || []); } catch {}
  }, []);
  useEffect(() => { fetchData(); fetchGallery(); }, [fetchData, fetchGallery]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); await fetchGallery(); setRefreshing(false); }, [fetchData, fetchGallery]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.shop.updateProfile(formData);
      notifySuccess();
      toast.success('Settings saved successfully');
      fetchData();
    } catch (error) { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const { data } = await api.shop.subscribe('stripe', 1);
      if (data.url) await WebBrowser.openBrowserAsync(data.url);
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to start subscription'); }
    finally { setSubscribing(false); }
  };

  /* the confirm button shakes before it lets you cancel */
  const openCancelDialog = () => {
    setCancelDialogOpen(true);
    shake.setValue(0);
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 110, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -0.5, duration: 90, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
    }, 350);
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await api.shop.cancelSubscription();
      toast.success('Subscription cancelled successfully');
      setCancelDialogOpen(false);
      navigation.navigate('Home');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to cancel subscription'); }
    finally { setCancelling(false); }
  };

  /* ===== gallery ===== */
  const handleGalleryUpload = async () => {
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true });
    if (res.canceled || !res.assets?.length) return;
    setGalleryUploading(true);
    try {
      const uploaded = [];
      for (const asset of res.assets) {
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) { toast.error('A photo exceeds 10MB limit, skipping'); continue; }
        try {
          const resp = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || 'photo.jpg', mimeType: asset.mimeType });
          uploaded.push({ url: `${MEDIA_BASE_URL}${resp.data.url}`, caption: '' });
        } catch (err) {}
      }
      if (uploaded.length === 0) { toast.error('No photos uploaded'); return; }
      const { data } = await api.shop.addGalleryPhotos(uploaded);
      setGallery(data.gallery || []);
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} added to gallery`);
    } catch (err) { toast.error('Failed to upload photos'); }
    finally { setGalleryUploading(false); }
  };

  const handleAddGalleryByUrl = async () => {
    if (!urlValue.trim()) return;
    try {
      const { data } = await api.shop.addGalleryPhotos([{ url: urlValue.trim(), caption: '' }]);
      setGallery(data.gallery || []);
      toast.success('Photo added to gallery');
      setUrlValue(''); setUrlDialogOpen(false);
    } catch { toast.error('Failed to add photo'); }
  };

  const handleDeletePhoto = (photoId) => {
    Alert.alert('Delete photo', 'Delete this photo from your gallery?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const { data } = await api.shop.deleteGalleryPhoto(photoId);
          setGallery(data.gallery || []);
          toast.success('Photo deleted');
        } catch { toast.error('Failed to delete photo'); }
      } },
    ]);
  };

  const handleSaveCaption = async () => {
    if (!editingPhoto) return;
    setEditingSaving(true);
    try {
      const { data } = await api.shop.updateGalleryPhoto(editingPhoto.id, { caption: editCaption });
      setGallery(data.gallery || []);
      toast.success('Caption updated');
      setEditingPhoto(null);
    } catch { toast.error('Failed to update caption'); }
    finally { setEditingSaving(false); }
  };

  const movePhoto = async (id, dir) => {
    const idx = gallery.findIndex(p => p.id === id);
    if (idx === -1) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= gallery.length) return;
    tapLight();
    const next = [...gallery];
    [next[idx], next[target]] = [next[target], next[idx]];
    setGallery(next);
    try { await api.shop.reorderGallery(next.map(p => p.id)); }
    catch { toast.error('Failed to save order'); fetchGallery(); }
  };

  const scrollToSection = (id) => {
    const y = sectionY.current[id];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };

  if (loading) {
    return <View style={st.center}><Spinner size={34} color="#059669" /></View>;
  }

  const showSubscription = subscription?.subscription_required !== false;
  const NAV_SECTIONS = [
    { id: 'profile-section', label: 'Shop Profile', icon: 'storefront', soft: '#d1fae5', tint: '#059669' },
    { id: 'branding-section', label: 'Branding & Photos', icon: 'camera', soft: '#ffe4e6', tint: '#e11d48' },
    { id: 'gallery-section', label: 'Gallery', icon: 'images', soft: colors.p100, tint: colors.p500 },
    ...(showSubscription ? [{ id: 'subscription-section', label: 'Subscription', icon: 'card', soft: '#fef3c7', tint: '#d97706' }] : []),
  ];

  const inputField = (label, key, opts = {}) => (
    <Input
      containerStyle={{ flex: 1, minWidth: 140 }}
      label={label}
      icon={opts.icon}
      value={formData[key]}
      onChangeText={(t) => setFormData(prev => ({ ...prev, [key]: t }))}
      keyboardType={opts.keyboardType}
      multiline={opts.multiline}
      placeholder={opts.placeholder}
      testID={opts.testID}
    />
  );

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} scrollRef={scrollRef} testID="shop-settings-content">
      {/* Hero — emerald-600 -> teal-600 -> cyan-600 */}
      <Rise duration={500} distance={0}>
        <LinearGradient colors={shop.topBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <View style={[st.blob, { top: -48, right: -48 }]} />
          <View style={[st.blob, { bottom: -64, left: -64, width: 240, height: 240, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <View style={st.heroIcon}><Ionicons name="storefront" size={26} color={colors.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.heroTitle} testID="shop-settings-title">Shop Settings</Text>
              <Text style={st.heroSub}>Customize your shop profile, branding & gallery</Text>
            </View>
          </View>
          <View style={st.heroChip}>
            <Ionicons name="sparkles" size={11} color={colors.white} />
            <Text style={st.heroChipText}>{shopData?.name || 'Your Shop'}</Text>
          </View>
        </LinearGradient>
      </Rise>

      {/* Quick section navigation */}
      <View style={st.navGrid}>
        {NAV_SECTIONS.map((s, i) => (
          <Rise key={s.id} delay={80 + i * 60} style={st.navWrap}>
            <PressScale onPress={() => scrollToSection(s.id)}>
              <View style={st.navCard} testID={`shop-settings-nav-${s.id}`}>
                <View style={[st.navIcon, { backgroundColor: s.soft }]}><Ionicons name={s.icon} size={15} color={s.tint} /></View>
                <Text style={st.navLabel} numberOfLines={1}>{s.label}</Text>
              </View>
            </PressScale>
          </Rise>
        ))}
      </View>

      {/* Shop Profile */}
      <Section icon="storefront" grad={['#10b981', '#0d9488']} title="Shop Profile" sub="Basic details visible to your customers"
        onLayout={(e) => { sectionY.current['profile-section'] = e.nativeEvent.layout.y; }} testID="shop-profile-section">
        <View style={{ gap: 11 }}>
          {inputField('Shop Name', 'name', { testID: 'shop-name-input' })}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {inputField('Email', 'email', { icon: 'mail', keyboardType: 'email-address', testID: 'shop-email-input' })}
            {inputField('Phone', 'phone', { icon: 'call', keyboardType: 'phone-pad', testID: 'shop-phone-input' })}
          </View>
          {inputField('Address', 'address', { icon: 'location', testID: 'shop-address-input' })}
          {inputField('Description', 'description', { icon: 'document-text', multiline: true, placeholder: 'Tell customers what makes your shop unique...', testID: 'shop-description-input' })}
        </View>
        <PressScale onPress={handleSave} disabled={saving} style={{ marginTop: 14, alignSelf: 'flex-end' }}>
          <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.saveBtn} testID="shop-save-profile-btn">
            {saving ? <Spinner size={13} /> : <Ionicons name="save" size={13} color={colors.white} />}
            <Text style={st.saveText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </LinearGradient>
        </PressScale>
      </Section>

      {/* Branding & Photos */}
      <Section icon="camera" grad={['#f43f5e', '#db2777']} title="Branding & Photos" sub="Upload your shop logo & cover photo"
        onLayout={(e) => { sectionY.current['branding-section'] = e.nativeEvent.layout.y; }} testID="shop-branding-section">
        <View style={{ gap: 10 }}>
          <BrandImagePicker label="Shop Logo (square, used as avatar)" value={formData.logo} onChange={(url) => setFormData(prev => ({ ...prev, logo: url }))} />
          <BrandImagePicker label="Cover Photo (wide banner)" hint="Shown on your public shop page header." wide
            value={formData.banner} onChange={(url) => setFormData(prev => ({ ...prev, banner: url }))} />
        </View>
        <PressScale onPress={handleSave} disabled={saving} style={{ marginTop: 14, alignSelf: 'flex-end' }}>
          <LinearGradient colors={['#f43f5e', '#db2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.saveBtn} testID="shop-save-branding-btn">
            {saving ? <Spinner size={13} /> : <Ionicons name="save" size={13} color={colors.white} />}
            <Text style={st.saveText}>{saving ? 'Saving...' : 'Save Branding'}</Text>
          </LinearGradient>
        </PressScale>
      </Section>

      {/* Gallery */}
      <Section icon="images" grad={[colors.p450, colors.p600]} title="Shop Gallery" sub="Showcase photos of your shop — visible on your public page"
        onLayout={(e) => { sectionY.current['gallery-section'] = e.nativeEvent.layout.y; }} testID="shop-gallery-section"
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PressScale onPress={handleGalleryUpload} disabled={galleryUploading}>
              <LinearGradient colors={[colors.p500, colors.p600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.gBtn} testID="gallery-upload-btn">
                {galleryUploading ? <Spinner size={12} /> : <Ionicons name="images" size={12} color={colors.white} />}
                <Text style={st.gBtnText}>{galleryUploading ? 'Uploading...' : 'Upload'}</Text>
              </LinearGradient>
            </PressScale>
            <TouchableOpacity onPress={() => setUrlDialogOpen(true)} style={st.gOutline}>
              <Text style={st.gOutlineText}>Add by URL</Text>
            </TouchableOpacity>
          </View>
        }>
        {gallery.length === 0 ? (
          <View style={st.galleryEmpty}>
            <Ionicons name="images" size={38} color={colors.p300} />
            <Text style={st.gEmptyTitle}>No photos in your gallery yet</Text>
            <Text style={st.gEmptyDesc}>Add up to dozens of photos to showcase your shop creatively</Text>
            <PressScale onPress={handleGalleryUpload} style={{ marginTop: 12 }}>
              <View style={st.gEmptyBtn}>
                <Ionicons name="images" size={12} color={colors.white} />
                <Text style={st.gBtnText}>Upload your first photo</Text>
              </View>
            </PressScale>
          </View>
        ) : (
          <>
            <Text style={st.gHint}>Use the arrows to reorder · tap the pencil to edit a caption</Text>
            <View style={st.galleryGrid} testID="gallery-grid">
              {gallery.map((photo, idx) => (
                <View key={photo.id} style={st.gItem} testID={`gallery-item-${photo.id}`}>
                  <Image source={{ uri: img(photo.url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={st.gOverlay}>
                    {photo.caption ? <Text style={st.gCaption} numberOfLines={1}>{photo.caption}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity onPress={() => movePhoto(photo.id, 'up')} disabled={idx === 0} style={[st.gAction, idx === 0 && { opacity: 0.35 }]}>
                        <Ionicons name="arrow-up" size={11} color={colors.white} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => movePhoto(photo.id, 'down')} disabled={idx === gallery.length - 1} style={[st.gAction, idx === gallery.length - 1 && { opacity: 0.35 }]}>
                        <Ionicons name="arrow-down" size={11} color={colors.white} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingPhoto(photo); setEditCaption(photo.caption || ''); }} style={st.gAction} testID={`gallery-edit-${photo.id}`}>
                        <Ionicons name="pencil" size={11} color={colors.white} />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity onPress={() => handleDeletePhoto(photo.id)} style={[st.gAction, { backgroundColor: 'rgba(239,68,68,0.75)' }]} testID={`gallery-delete-${photo.id}`}>
                        <Ionicons name="trash" size={11} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </>
        )}
      </Section>

      {/* Subscription — amber section, rose danger zone */}
      {showSubscription && (
        <Section icon="card" grad={['#f59e0b', '#ea580c']} title="Subscription" sub="Manage your monthly plan"
          onLayout={(e) => { sectionY.current['subscription-section'] = e.nativeEvent.layout.y; }} testID="shop-subscription-section">
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={st.subStat}>
              <Text style={st.subStatKey}>STATUS</Text>
              <Text style={[st.subStatVal, {
                color: subscription?.subscription_status === 'active' ? '#059669' :
                  subscription?.subscription_status === 'trial' ? '#2563eb' :
                  subscription?.subscription_status === 'expired' ? '#dc2626' : colors.textSecondary,
                textTransform: 'capitalize',
              }]}>{subscription?.subscription_status || 'None'}</Text>
            </View>
            {subscription?.subscription_end ? (
              <View style={st.subStat}>
                <Text style={st.subStatKey}>VALID UNTIL</Text>
                <Text style={st.subStatVal}>{new Date(subscription.subscription_end).toLocaleDateString()}</Text>
              </View>
            ) : null}
            <View style={st.subStat}>
              <Text style={st.subStatKey}>PRICE</Text>
              <Text style={st.subStatVal}>${subscription?.price || 29}<Text style={{ fontSize: 10, color: colors.textMuted }}>/month</Text></Text>
            </View>
          </View>
          {(subscription?.subscription_status === 'none' || subscription?.subscription_status === 'expired') && (
            <PressScale onPress={handleSubscribe} disabled={subscribing}>
              <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.saveBtn, { alignSelf: 'flex-start' }]} testID="shop-subscribe-btn">
                {subscribing ? <Spinner size={13} /> : <Ionicons name="card" size={13} color={colors.white} />}
                <Text style={st.saveText}>{subscribing ? 'Processing...' : 'Subscribe Now'}</Text>
              </LinearGradient>
            </PressScale>
          )}
          {(subscription?.subscription_status === 'active' || subscription?.subscription_status === 'trial') && (
            <LinearGradient colors={['#fff1f2', '#fdf2f8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.dangerZone}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="warning" size={14} color="#e11d48" />
                <Text style={st.dangerTitle}>Danger Zone</Text>
              </View>
              <PressScale onPress={openCancelDialog}>
                <View style={st.cancelBtn} testID="cancel-subscription-btn">
                  <Ionicons name="warning" size={13} color="#dc2626" />
                  <Text style={st.cancelBtnText}>Cancel Subscription</Text>
                </View>
              </PressScale>
            </LinearGradient>
          )}
        </Section>
      )}
    </ShopScreenWrap>

    {/* Cancel subscription confirm — the confirm button shakes */}
    <Modal visible={cancelDialogOpen} transparent animationType="fade" onRequestClose={() => setCancelDialogOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCancelDialogOpen(false)} />
        <View style={st.dialog}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="warning" size={18} color="#dc2626" />
            <Text style={[st.dialogTitle, { color: '#dc2626' }]}>Cancel Subscription</Text>
          </View>
          <Text style={st.dialogBody}>Are you sure you want to cancel your subscription? This will:</Text>
          <View style={{ gap: 5, marginTop: 8 }}>
            {['Deactivate your shop immediately', 'Remove your seller access', 'Your products will no longer be visible'].map(li => (
              <View key={li} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={st.bullet} />
                <Text style={st.dialogBody}>{li}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
            <PressScale style={{ flex: 1 }} onPress={() => setCancelDialogOpen(false)}>
              <View style={st.keepBtn} testID="cancel-subscription-dismiss"><Text style={st.keepText}>Keep Subscription</Text></View>
            </PressScale>
            <Animated.View style={{ flex: 1, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }}>
              <PressScale onPress={handleCancelSubscription} disabled={cancelling}>
                <View style={st.redBtn} testID="confirm-cancel-subscription-btn">
                  {cancelling ? <Spinner size={13} /> : null}
                  <Text style={st.redText}>{cancelling ? 'Cancelling...' : 'Yes, Cancel'}</Text>
                </View>
              </PressScale>
            </Animated.View>
          </View>
        </View>
      </BlurView>
    </Modal>

    {/* Add gallery photo by URL */}
    <Modal visible={urlDialogOpen} transparent animationType="fade" onRequestClose={() => setUrlDialogOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setUrlDialogOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <Text style={st.dialogTitle}>Add Photo by URL</Text>
            <TextInput value={urlValue} onChangeText={setUrlValue} placeholder="https://..." autoCapitalize="none"
              placeholderTextColor={colors.textMuted} style={[st.input, { marginTop: 10 }]} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PressScale style={{ flex: 1 }} onPress={() => setUrlDialogOpen(false)}>
                <View style={st.keepBtn}><Text style={st.keepText}>Cancel</Text></View>
              </PressScale>
              <PressScale style={{ flex: 1 }} onPress={handleAddGalleryByUrl}>
                <View style={[st.redBtn, { backgroundColor: '#059669' }]}><Text style={st.redText}>Add Photo</Text></View>
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>

    {/* Edit gallery caption */}
    <Modal visible={!!editingPhoto} transparent animationType="fade" onRequestClose={() => setEditingPhoto(null)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditingPhoto(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Ionicons name="pencil" size={15} color={colors.p500} />
              <Text style={st.dialogTitle}>Edit Photo Caption</Text>
            </View>
            {editingPhoto ? (
              <View style={st.editPreview}><Image source={{ uri: img(editingPhoto.url) }} style={{ width: '100%', height: 150 }} resizeMode="cover" /></View>
            ) : null}
            <Text style={[st.label, { marginTop: 10, marginBottom: 5 }]}>Caption (optional)</Text>
            <TextInput value={editCaption} onChangeText={setEditCaption} multiline placeholder="Describe this photo for your customers..."
              placeholderTextColor={colors.textMuted} style={[st.input, { height: 76, textAlignVertical: 'top' }]} testID="gallery-caption-input" />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PressScale style={{ flex: 1 }} onPress={() => setEditingPhoto(null)}>
                <View style={st.keepBtn}><Text style={st.keepText}>Cancel</Text></View>
              </PressScale>
              <PressScale style={{ flex: 1 }} onPress={handleSaveCaption} disabled={editingSaving}>
                <View style={[st.redBtn, { backgroundColor: colors.p500, flexDirection: 'row', gap: 6 }]} testID="save-gallery-caption-btn">
                  {editingSaving ? <Spinner size={13} /> : <Ionicons name="save" size={13} color={colors.white} />}
                  <Text style={st.redText}>Save Caption</Text>
                </View>
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', ...shadow.emphasis },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.heading, fontSize: 25, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 13 },
  heroChipText: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.bold, fontSize: 11 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  navWrap: { flexBasis: '47%', flexGrow: 1 },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, ...shadow.card },
  navIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13, color: colors.text, backgroundColor: colors.surface },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 17, paddingVertical: 11, ...shadow.card },
  saveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  gBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, ...shadow.card },
  gBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  gOutline: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 8 },
  gOutlineText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  galleryEmpty: { alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.p200, backgroundColor: 'rgba(245,243,255,0.3)', borderRadius: radius.lg, paddingVertical: 30, paddingHorizontal: 18 },
  gEmptyTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text, marginTop: 10 },
  gEmptyDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 3, textAlign: 'center' },
  gEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.p500, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  gHint: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginBottom: 9 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gItem: { width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.borderLight, flexGrow: 1 },
  gOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 6, paddingTop: 18 },
  gCaption: { color: colors.white, fontFamily: fonts.body, fontSize: 9, marginBottom: 4 },
  gAction: { width: 23, height: 23, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  subStat: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, backgroundColor: colors.surfaceMuted },
  subStatKey: { fontFamily: fonts.extrabold, fontSize: 8.5, color: colors.textMuted, letterSpacing: 1 },
  subStatVal: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, marginTop: 3 },
  dangerZone: { borderWidth: 1, borderColor: '#fecdd3', borderRadius: radius.md, padding: 13 },
  dangerTitle: { fontFamily: fonts.extrabold, fontSize: 12, color: '#e11d48', letterSpacing: 0.4 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 11 },
  cancelBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#dc2626' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow.dropdown },
  dialogTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.ink },
  dialogBody: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.textMuted },
  keepBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  keepText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  redBtn: { height: 44, borderRadius: radius.md, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  redText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  editPreview: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
});
