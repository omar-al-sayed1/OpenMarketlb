import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Image, Share, Platform, Clipboard, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { pickImage } from '../../lib/imagePick';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { api, getAuthToken } from '../../lib/api';
import { API_BASE_URL } from '../../config';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { tapLight, notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import {
  ShopScreenWrap, Rise, ScaleIn, Float, Pulse, CountUp, PressScale, MorphButton, SoftButton, Spinner, ShopCard, CardHead, ShopPill, toast,
} from '../../components/shop/ShopKit';
import ShopOnboarding from '../../components/shop/ShopOnboarding';
import GiftSheet from '../../components/shop/GiftSheet';
import SpinWheelModal from '../../components/shop/SpinWheelModal';
import { SubscribeConfirmSheet, SubscribedWelcomeSheet, FirstLoginWelcomeSheet } from '../../components/shop/ShopSubscriptionSheets';

// The public storefront web origin — in dev the web app runs on :3000 next to the API.
const WEB_ORIGIN = MEDIA_BASE_URL.replace(/:\d+$/, ':3000');

/* Growth tips (ported verbatim) */
const TIPS = [
  { title: 'Quality Photos', desc: 'Products with pro images get 3x more views. Multiple angles help.', color: '#60a5fa' },
  { title: 'Run Discounts', desc: 'Limited-time offers create urgency and boost conversions.', color: '#34d399' },
  { title: 'Fast Replies', desc: 'Quick message responses build trust and repeat purchases.', color: '#fbbf24' },
  { title: 'Share Your Link', desc: 'Promote on Instagram, WhatsApp & Facebook for more traffic.', color: '#fb7185' },
  { title: 'Add Variants', desc: 'Color & size options increase clicks and conversion rates.', color: colors.p400 },
  { title: 'Keep Stock Fresh', desc: 'Low stock alerts prevent overselling. Restock regularly.', color: '#2dd4bf' },
];

/* shimmering diagonal sweep for the advertising CTA */
function ShineSweep() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(2200),
    ])).start();
  }, [a]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: -40, bottom: -40, width: 70, backgroundColor: 'rgba(255,255,255,0.15)',
      transform: [
        { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-120, 460] }) },
        { rotate: '12deg' },
      ],
    }} />
  );
}

/* animated progress bar for the shop score */
function ScoreBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: pct, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct, a]);
  return (
    <View style={st.scoreTrack}>
      <Animated.View style={[st.scoreFill, { backgroundColor: color, width: a.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export default function ShopDashboardScreen({ navigation }) {
  const [viewer, setViewer] = useState(null); // { uri, label } — fullscreen logo/cover preview
  const [shopData, setShopData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [tierInfo, setTierInfo] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);
  const [spinInfo, setSpinInfo] = useState(null);
  const [shopGifts, setShopGifts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState(50);
  const [subscriptionPrice, setSubscriptionPrice] = useState(19);
  const [planFeatures, setPlanFeatures] = useState([]);
  const [planName, setPlanName] = useState('Subscription');
  const [confirmSubscribeOpen, setConfirmSubscribeOpen] = useState(false);
  const [welcomeBenefitsOpen, setWelcomeBenefitsOpen] = useState(false);
  const [firstLoginData, setFirstLoginData] = useState(null);
  const [firstLoginOpen, setFirstLoginOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    fetchData();
    // Shops also have loyalty points
    api.loyalty.getStatus().then(({ data }) => { if (data?.enabled) setLoyaltyData(data); }).catch(() => {});
    // Admin-configured shop cashback percentage + subscription price
    api.admin.getPlatformSettings().then(({ data }) => {
      if (data?.shop_cashback_percent != null) setCashbackPercent(Number(data.shop_cashback_percent));
      if (data?.subscription_price != null) setSubscriptionPrice(Number(data.subscription_price));
    }).catch(() => {});
    // Subscription plan features/perks — single source of truth (admin-configured)
    api.shop.getSubscriptionPricing().then(({ data }) => {
      if (Array.isArray(data?.features)) setPlanFeatures(data.features);
      if (data?.plan_name) setPlanName(data.plan_name);
      if (data?.monthly?.price != null) setSubscriptionPrice(Number(data.monthly.price));
    }).catch(() => {});
    // First-login welcome popup (shows once)
    api.shop.getWelcomePopup().then(({ data }) => {
      if (data?.show) { setFirstLoginData(data); setFirstLoginOpen(true); }
    }).catch(() => {});
  }, []); // eslint-disable-line

  const fetchData = async () => {
    try {
      const [shopRes, analyticsRes, subRes, tierRes, promoRes, spinRes, giftsRes] = await Promise.allSettled([
        api.shop.getProfile(),
        api.shop.getAnalytics(),
        api.shop.getSubscription(),
        api.shopTier.getInfo(),
        api.shopPromotions.getAll(),
        api.shopSpin.getInfo(),
        api.shopGifts.getAll(),
      ]);
      if (shopRes.status === 'fulfilled') setShopData(shopRes.value.data);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
      if (subRes.status === 'fulfilled') setSubscription(subRes.value.data);
      if (tierRes.status === 'fulfilled') setTierInfo(tierRes.value.data);
      if (promoRes.status === 'fulfilled') setPromotions(promoRes.value.data?.promotions?.filter(p => p.status === 'active') || []);
      if (spinRes.status === 'fulfilled') setSpinInfo(spinRes.value.data);
      if (giftsRes.status === 'fulfilled') setShopGifts(giftsRes.value.data?.gifts || []);
      try { const { data } = await api.shop.getOrders(); setRecentOrders((data.orders || data || []).slice(0, 5)); } catch {}
    } catch (error) {
      if (error.response?.status === 403) { toast.error('Shop access required'); navigation.navigate('Home'); }
    } finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []); // eslint-disable-line

  const dismissFirstLogin = () => {
    setFirstLoginOpen(false);
    api.shop.dismissWelcomePopup().catch(() => {});
  };

  // Subscribed = requires a subscription AND it's active/trial (free shops are not subscribers)
  const isSubscribed = shopData && shopData.subscription_required !== false && ['active', 'trial'].includes(shopData.subscription_status);
  const walletBalance = Number(shopData?.wallet_balance || 0);
  const isSubscriptionActive = subscription?.subscription_status === 'trial' || subscription?.subscription_status === 'active' || subscription?.subscription_required === false;
  const isExpired = (subscription?.subscription_status === 'expired' || subscription?.is_expired) && subscription?.subscription_required !== false;
  const isPending = subscription?.subscription_status === 'pending';

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const { data } = await api.shop.renewSubscription();
      toast.success(data.message || 'Subscription renewed!');
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to renew'); }
    finally { setRenewing(false); }
  };

  const handleSubscribeWithWallet = async () => {
    if (walletBalance < subscriptionPrice) {
      toast.error(`Not enough wallet balance. You need $${subscriptionPrice.toFixed(2)} but have $${walletBalance.toFixed(2)}.`);
      return;
    }
    setSubscribing(true);
    try {
      await api.shop.subscribe('wallet', 1);
      setConfirmSubscribeOpen(false);
      await fetchData();
      setWelcomeBenefitsOpen(true); // welcoming popup with the benefits
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to subscribe'); }
    finally { setSubscribing(false); }
  };

  const handleStartTrial = async () => {
    try {
      await api.shop.startTrial();
      toast.success('Trial started!');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to start trial'); }
  };

  const handleSubscribeWithCard = async () => {
    setSubscribing(true);
    try {
      const { data } = await api.shop.subscribe('stripe', 1);
      if (data.url) await WebBrowser.openBrowserAsync(data.url);
      else toast.error('Failed to create checkout session');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to start subscription'); }
    finally { setSubscribing(false); }
  };

  /* ===== Quick Cover/Logo Upload ===== */
  const uploadImageAndUpdateShop = async (field) => {
    // Crop to a fixed aspect on pick: cover = rectangular (16:9), logo = square (1:1).
    const res = await pickImage({ mediaTypes: ['images'], allowsEditing: true, aspect: field === 'banner' ? [16, 9] : [1, 1] });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) { toast.error('File too large (max 10MB)'); return; }
    if (field === 'banner') setUploadingCover(true); else setUploadingLogo(true);
    try {
      const resp = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || `${field}.jpg`, mimeType: asset.mimeType });
      const url = `${MEDIA_BASE_URL}${resp.data.url}`;
      await api.shop.updateProfile({ [field]: url });
      setShopData((prev) => (prev ? { ...prev, [field]: url } : prev)); // snappy UX
      toast.success(field === 'banner' ? 'Cover photo updated' : 'Logo updated');
    } catch (err) { toast.error('Upload failed'); }
    finally { if (field === 'banner') setUploadingCover(false); else setUploadingLogo(false); }
  };

  const copyShopLink = () => {
    Clipboard.setString(`${WEB_ORIGIN}/shop/${shopData?.id}`);
    tapLight();
    toast.success('Link copied!');
  };

  const downloadReport = async () => {
    setReportBusy(true);
    try {
      const dest = FileSystem.cacheDirectory + `shop_report_${new Date().toISOString().split('T')[0]}.pdf`;
      const { uri, status } = await FileSystem.downloadAsync(`${API_BASE_URL}${api.shop.reportPdfPath}`, dest, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (status !== 200) throw new Error('bad status');
      setReportDone(true); notifySuccess();
      toast.success('Report downloaded!');
      try { await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: uri, title: 'Shop Report' }); } catch {}
      setTimeout(() => setReportDone(false), 1800);
    } catch { toast.error('Failed to download report'); }
    finally { setReportBusy(false); }
  };

  const goPage = (title) => navigation.navigate('ShopPage', { title });

  /* ===== Loading (emerald ring + store icon) ===== */
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={52} color="#10b981" />
          <Ionicons name="storefront" size={22} color="#059669" style={{ position: 'absolute' }} />
        </View>
      </View>
    );
  }

  const end = subscription?.subscription_end ? new Date(subscription.subscription_end) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))) : null;
  const canRenew = walletBalance >= subscriptionPrice;
  const overallScore = Math.round(
    ((analytics?.products_count || 0) / 50 * 25) +
    ((analytics?.total_orders || 0) / 100 * 35) +
    (promotions.length / 5 * 20) +
    (Math.max(0, ((analytics?.products_count || 1) - (analytics?.low_stock_count || 0)) / (analytics?.products_count || 1)) * 20)
  );

  const stats = [
    { label: 'Products', value: analytics?.products_count || 0, icon: 'cube', tile: shop.tiles.blue },
    { label: 'Low Stock', value: analytics?.low_stock_count || 0, icon: 'alert-circle', tile: shop.tiles.rose },
    { label: 'Commission', value: `${analytics?.commission_percentage || 0}%`, icon: 'locate', tile: shop.tiles.amber, raw: true },
    { label: 'Promotions', value: promotions.length, icon: 'megaphone', tile: shop.tiles.violet },
    { label: 'Gifts', value: shopGifts.length, icon: 'gift', tile: shop.tiles.pink },
  ];

  const quickActions = [
    { label: 'Products', icon: 'cube', grad: shop.tiles.blue.grad, go: () => navigation.navigate('ShopProducts') },
    { label: 'Orders', icon: 'cart', grad: shop.tiles.emerald.grad, go: () => navigation.navigate('ShopOrders') },
    { label: 'Analytics', icon: 'bar-chart', grad: shop.tiles.violet.grad, go: () => navigation.navigate('ShopAnalytics') },
    { label: 'Advertising', icon: 'rocket', grad: shop.tiles.fuchsia.grad, go: () => navigation.navigate('ShopAdvertising') },
    { label: 'Gallery', icon: 'images', grad: shop.tiles.pink.grad, go: () => navigation.navigate('ShopGallery') },
    { label: 'Themes', icon: 'sparkles', grad: shop.tiles.amber.grad, go: () => navigation.navigate('ShopTheme') },
  ];

  return (
    <>
    <ShopScreenWrap wash={shop.wash} refreshing={refreshing} onRefresh={onRefresh}>
      {/* ===== HERO COVER + LOGO ===== */}
      <Rise duration={600} distance={0}>
        <View style={st.hero} testID="shop-cover-logo-hero">
          <View style={st.coverWrap}>
            {shopData?.banner ? (
              <TouchableOpacity activeOpacity={0.92} style={StyleSheet.absoluteFill} onPress={() => setViewer({ uri: shopData.banner, label: 'Cover photo' })}>
                <Image source={{ uri: img(shopData.banner) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <LinearGradient colors={shop.heroCover} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            {/* soft gradient overlay for legibility */}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFill} />
            {/* Edit cover button */}
            <TouchableOpacity onPress={() => uploadImageAndUpdateShop('banner')} disabled={uploadingCover} activeOpacity={0.85}
              style={st.editCover} testID="edit-cover-photo-btn">
              {uploadingCover ? <Spinner size={13} color={colors.text} /> : <Ionicons name="camera" size={13} color={colors.text} />}
              <Text style={st.editCoverText}>{uploadingCover ? 'Uploading...' : 'Edit Cover'}</Text>
            </TouchableOpacity>
          </View>

          {/* LOGO + INFO */}
          <View style={st.heroBody}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: -44 }}>
              <View>
                <TouchableOpacity activeOpacity={0.9} disabled={!shopData?.logo} onPress={() => shopData?.logo && setViewer({ uri: shopData.logo, label: 'Shop logo' })}>
                  <View style={st.logoGlow}>
                    <View style={st.logoBox}>
                      {shopData?.logo ? (
                        <Image source={{ uri: img(shopData.logo) }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <LinearGradient colors={shop.activePill} style={st.logoFallback}><Ionicons name="storefront" size={36} color={colors.white} /></LinearGradient>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => uploadImageAndUpdateShop('logo')} disabled={uploadingLogo} activeOpacity={0.85}
                  style={st.editLogo} testID="edit-logo-btn">
                  {uploadingLogo ? <Spinner size={12} /> : <Ionicons name="camera" size={12} color={colors.white} />}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 12, paddingBottom: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Text style={st.shopName} numberOfLines={1} testID="shop-dashboard-title">{shopData?.name || 'Your Shop'}</Text>
                  {shopData?.is_verified && (
                    <View style={st.verified}><Ionicons name="shield-checkmark" size={10} color="#1d4ed8" /><Text style={st.verifiedText}>Verified</Text></View>
                  )}
                </View>
                <Text style={st.dateLine}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  {end && isSubscriptionActive && subscription?.subscription_required !== false ? (
                    <Text style={{ color: '#059669', fontFamily: fonts.semibold }}> · {Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24))} days left</Text>
                  ) : null}
                </Text>
              </View>
            </View>

            {/* Quick actions */}
            <View style={st.quickRow}>
              <MorphButton small label="Continue Shopping" icon="cart" grad={[colors.p450, colors.s600]} onPress={() => navigation.navigate('Home')} />
              <SoftButton small label="Copy Link" icon="link" color="#047857" border="#a7f3d0" onPress={copyShopLink} />
              <SoftButton small label="Settings" icon="create-outline" color={colors.textSecondary} onPress={() => navigation.navigate('ShopSettings')} />
              <MorphButton small label="Gift" icon="gift" grad={shop.gift} onPress={() => setGiftDialogOpen(true)} />
              <SoftButton small label={reportBusy ? 'Preparing…' : reportDone ? 'Done!' : 'Report'} icon={reportDone ? 'checkmark' : 'download-outline'}
                color="#047857" border="#a7f3d0" loading={reportBusy} onPress={downloadReport} />
            </View>
          </View>
        </View>
      </Rise>

      {/* ===== ONBOARDING WIZARD ===== */}
      <View style={{ marginTop: 14 }}><ShopOnboarding navigation={navigation} /></View>

      {/* ===== SUBSCRIBE CTA (shops without an active subscription) ===== */}
      {!isSubscribed && (
        <Rise delay={80}>
          <LinearGradient colors={shop.subscribe} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.subCard} testID="shop-subscribe-card">
            <View style={[st.blob, { top: -40, right: -40 }]} />
            <View style={[st.blob, { bottom: -48, left: '25%', width: 128, height: 128 }]} />
            <View style={{ flexDirection: 'row', gap: 11 }}>
              <View style={st.subIcon}><Ionicons name="ribbon" size={22} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.subTitle}>Subscribe & unlock monthly perks</Text>
                <Text style={st.subSub}>Get more from your shop, every month from your subscription date.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(planFeatures.length ? planFeatures : ['1 free spin / month', '2 sponsors / month', 'Lower commissions']).slice(0, 4).map((f, i) => (
                    <View key={i} style={st.featureChip}>
                      <Ionicons name="sparkles" size={9} color={colors.white} />
                      <Text style={st.featureChipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <Text style={st.subPrice}>${subscriptionPrice.toFixed(2)}<Text style={st.subPerMo}>/mo</Text></Text>
              <Text style={st.subWallet}>Paid from wallet — ${walletBalance.toFixed(2)} available</Text>
              <PressScale onPress={() => (walletBalance < subscriptionPrice ? navigation.navigate('ShopWallet') : setConfirmSubscribeOpen(true))} disabled={subscribing} style={{ marginTop: 8, alignSelf: 'stretch' }}>
                <View style={st.subBtn} testID="shop-subscribe-btn">
                  {subscribing ? <Spinner size={15} color="#ea580c" /> : <Ionicons name="ribbon" size={15} color="#ea580c" />}
                  <Text style={st.subBtnText}>{walletBalance < subscriptionPrice ? 'Add wallet funds to subscribe' : 'Subscribe now'}</Text>
                </View>
              </PressScale>
            </View>
          </LinearGradient>
        </Rise>
      )}

      {/* ===== YOUR SUBSCRIPTION PLAN (subscribed shops) ===== */}
      {isSubscribed && (
        <Rise delay={80}>
          <LinearGradient colors={shop.plan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.subCard} testID="shop-plan-card">
            <View style={[st.blob, { top: -40, right: -40 }]} />
            <View style={[st.blob, { bottom: -48, left: '25%', width: 128, height: 128 }]} />
            <View style={{ flexDirection: 'row', gap: 11 }}>
              <View style={st.subIcon}><Ionicons name="ribbon" size={22} color="#fce883" /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.planKicker}>YOUR PLAN SUBSCRIPTION</Text>
                <Text style={st.subTitle}>{planName}</Text>
                {end && (
                  <Text style={st.subSub}>
                    Active until <Text style={{ fontFamily: fonts.bold }}>{end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    {daysLeft != null ? ` · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : ''}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ marginTop: 14 }}>
              <PressScale onPress={canRenew ? handleRenew : () => navigation.navigate('ShopWallet')} disabled={renewing}>
                <View style={st.subBtn} testID="shop-renew-btn">
                  {renewing ? <Spinner size={15} color={colors.p800} /> : <Ionicons name="refresh" size={15} color={colors.p800} />}
                  <Text style={[st.subBtnText, { color: colors.p800 }]}>{canRenew ? `Renew +30 days ($${subscriptionPrice.toFixed(2)})` : 'Add funds to renew'}</Text>
                </View>
              </PressScale>
              <Text style={[st.subWallet, { textAlign: 'center', marginTop: 6 }]}>
                {canRenew ? `Paid from wallet — $${walletBalance.toFixed(2)} available` : `Need $${subscriptionPrice.toFixed(2)} · you have $${walletBalance.toFixed(2)}`}
              </Text>
            </View>
          </LinearGradient>
        </Rise>
      )}

      {/* ===== SHOP CASHBACK & LOYALTY ===== */}
      <View style={{ gap: 12, marginTop: 14 }} testID="shop-cashback-loyalty-row">
        <Rise delay={120}>
          <View style={[st.tintCard, { backgroundColor: '#ecfdf5', borderColor: 'rgba(167,243,208,0.7)' }]} testID="shop-cashback-info">
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <LinearGradient colors={['#10b981', '#0d9488']} style={st.tintIcon}><Ionicons name="wallet" size={22} color={colors.white} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={st.tintTitle}>Special Shop Cashback</Text>
                  <LinearGradient colors={shop.activePill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.pctBadge}>
                    <Ionicons name="sparkles" size={8} color={colors.white} />
                    <Text style={st.pctBadgeText}>{cashbackPercent}%</Text>
                  </LinearGradient>
                </View>
                <Text style={st.tintBody}>
                  You earn <Text style={{ fontFamily: fonts.bold, color: '#047857' }}>{cashbackPercent}% of the commission</Text> back as cashback when your order is <Text style={{ fontFamily: fonts.bold }}>paid</Text>. The rest goes to admin, and your share is credited to your shop wallet once payment is confirmed.
                </Text>
                <View style={st.exampleChip}>
                  <Ionicons name="logo-usd" size={10} color="#047857" />
                  <Text style={st.exampleText}>Example: $10 commission → ${(10 * cashbackPercent / 100).toFixed(2)} credited after payment</Text>
                </View>
                <MorphButton small label="Continue Shopping" icon="cart" grad={shop.activePill} onPress={() => navigation.navigate('Shop')} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
              </View>
            </View>
          </View>
        </Rise>

        {loyaltyData && loyaltyData.enabled !== false ? (
          <Rise delay={180}>
            <View style={[st.tintCard, { backgroundColor: '#fffbeb', borderColor: 'rgba(253,230,138,0.7)' }]} testID="shop-loyalty-card">
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <LinearGradient colors={['#f59e0b', '#ea580c']} style={st.tintIcon}><Ionicons name="star" size={22} color={colors.white} /></LinearGradient>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={st.tintTitle}>Loyalty Points</Text>
                    <View style={st.tierBadge}><Text style={st.tierBadgeText}>{loyaltyData.tier?.name || 'Member'}</Text></View>
                  </View>
                  <Text style={st.tintBody}>Earn points & redeem on every purchase, just like regular customers.</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18, marginTop: 8 }}>
                    <View>
                      <Text style={st.loyKicker}>BALANCE</Text>
                      <Text style={st.loyValue}>{(loyaltyData.points_balance || 0).toLocaleString()}</Text>
                    </View>
                    <View>
                      <Text style={st.loyKicker}>WORTH</Text>
                      <Text style={[st.loyValue, { color: '#047857' }]}>${(loyaltyData.redeem_value || 0).toFixed(2)}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <MorphButton small label="Redeem Now" grad={['#f59e0b', '#f97316']} onPress={() => navigation.navigate('Cart')} />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </Rise>
        ) : (
          <Rise delay={180}>
            <View style={[st.tintCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 }]} testID="shop-loyalty-card-empty">
              <View style={[st.tintIcon, { backgroundColor: colors.border }]}><Ionicons name="star" size={22} color={colors.textMuted} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.tintTitle}>Loyalty Program</Text>
                <Text style={st.tintBody}>Place an order to start earning loyalty points!</Text>
              </View>
              <SoftButton small label="Shop Now" onPress={() => navigation.navigate('Home')} />
            </View>
          </Rise>
        )}
      </View>

      {/* ===== ALERTS ===== */}
      {isPending && (
        <Rise delay={100}>
          <View style={[st.alert, { backgroundColor: '#fffbeb', borderColor: 'rgba(253,230,138,0.7)' }]}>
            <View style={[st.alertIcon, { backgroundColor: '#fef3c7' }]}><Ionicons name="time" size={18} color="#d97706" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[st.alertTitle, { color: '#78350f' }]}>Pending Admin Activation</Text>
              <Text style={[st.alertBody, { color: '#b45309' }]}>Your subscription request is being reviewed. You'll receive an email once activated.</Text>
            </View>
          </View>
        </Rise>
      )}

      {isExpired && (
        <Rise delay={100}>
          <View style={[st.alert, { backgroundColor: '#fef2f2', borderColor: 'rgba(254,202,202,0.7)' }]} testID="expired-subscription-alert">
            <View style={[st.alertIcon, { backgroundColor: '#fee2e2' }]}><Ionicons name="warning" size={18} color="#dc2626" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[st.alertTitle, { color: '#7f1d1d' }]}>Subscription Expired</Text>
              <Text style={[st.alertBody, { color: '#b91c1c' }]}>Your products are no longer visible. Renew to continue selling.</Text>
              <MorphButton small label={`Renew ($${subscription?.price}/mo)`} icon="card" grad={['#dc2626', '#b91c1c']} loading={subscribing}
                onPress={handleSubscribeWithCard} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </View>
          </View>
        </Rise>
      )}

      {/* Unverified Seller Warning */}
      {shopData && !shopData.is_verified && isSubscriptionActive && (
        <Rise delay={160}>
          <View style={[st.alert, { backgroundColor: '#fff7ed', borderColor: 'rgba(254,215,170,0.7)' }]} testID="unverified-seller-warning">
            <View style={[st.alertIcon, { backgroundColor: '#ffedd5' }]}><Ionicons name="warning" size={18} color="#ea580c" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[st.alertTitle, { color: '#7c2d12' }]}>Shop Not Verified</Text>
              <Text style={[st.alertBody, { color: '#c2410c' }]}>Verified sellers get higher ranking in search results and a trusted badge. Complete verification to boost your visibility.</Text>
              <MorphButton small label="Get Verified Now" icon="shield-checkmark" grad={['#f97316', '#f59e0b']}
                onPress={() => navigation.navigate('ShopVerification')} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </View>
          </View>
        </Rise>
      )}

      {!isPending && !isSubscriptionActive && !isExpired && subscription?.subscription_status === 'none' && (
        <Rise delay={100}>
          <View style={[st.alert, { backgroundColor: '#f0f9ff', borderColor: 'rgba(186,230,253,0.7)' }]}>
            <View style={[st.alertIcon, { backgroundColor: '#e0f2fe' }]}><Ionicons name="flash" size={18} color="#0284c7" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[st.alertTitle, { color: '#0c4a6e' }]}>Get Started</Text>
              <Text style={[st.alertBody, { color: '#0369a1' }]}>Start your {subscription?.trial_days}-day free trial or subscribe to begin selling.</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <MorphButton small label="Start Free Trial" grad={['#059669', '#047857']} onPress={handleStartTrial} />
                <SoftButton small label="Pay with Card" icon="card" loading={subscribing} onPress={handleSubscribeWithCard} />
              </View>
            </View>
          </View>
        </Rise>
      )}

      {/* ===== REVENUE HERO ===== */}
      <Rise delay={140}>
        <LinearGradient colors={shop.revenue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.revenue} testID="revenue-banner">
          <View style={[st.blob, { top: -60, right: -60, width: 180, height: 180, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <View style={[st.blob, { bottom: -50, left: -40, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <Float style={{ position: 'absolute', top: '50%', right: '25%' }} dur={4000}><View style={st.particleLg} /></Float>
          <Float style={{ position: 'absolute', bottom: '33%', right: '33%' }} dur={3000} delay={1500}><View style={st.particleSm} /></Float>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <View style={st.revIcon}><Ionicons name="trending-up" size={15} color={colors.white} /></View>
            <Text style={st.revKicker}>NET REVENUE</Text>
          </View>
          <ScaleIn delay={200}>
            <CountUp value={Number(analytics?.total_revenue || 0)} prefix="$" decimals={2} style={st.revValue} />
          </ScaleIn>
          <Text style={st.revNote}>Credited to your wallet after commission</Text>
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
            {[
              { k: 'GROSS SALES', v: `$${Number(analytics?.gross_revenue || 0).toFixed(2)}` },
              { k: 'TOTAL ORDERS', v: `${analytics?.total_orders || 0}` },
              { k: 'AVG ORDER', v: `$${analytics?.total_orders > 0 ? (analytics.total_revenue / analytics.total_orders).toFixed(0) : '0'}` },
            ].map(x => (
              <View key={x.k} style={st.revTile}>
                <Text style={st.revTileK}>{x.k}</Text>
                <Text style={st.revTileV}>{x.v}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Rise>

      {/* ===== WALLET + STATUS CARDS ===== */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Rise delay={200} style={{ flex: 1 }}>
          <ShopCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <LinearGradient colors={[colors.p450, colors.p600]} style={st.miniTile}><Ionicons name="wallet" size={15} color={colors.white} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={st.miniKicker}>WALLET BALANCE</Text>
                <CountUp value={Number(tierInfo?.wallet_balance || 0)} prefix="$" decimals={2} style={st.miniValue} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={st.miniFoot}>Monthly credit: <Text style={{ color: colors.p800, fontFamily: fonts.semibold }}>${tierInfo?.monthly_wallet_credit || 0}</Text></Text>
              <TouchableOpacity onPress={() => navigation.navigate('ShopWallet')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.p500 }}>View</Text>
                <Ionicons name="chevron-forward" size={11} color={colors.p500} />
              </TouchableOpacity>
            </View>
          </ShopCard>
        </Rise>
        <Rise delay={280} style={{ flex: 1 }}>
          <ShopCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <LinearGradient colors={shop.activePill} style={st.miniTile}><Ionicons name="layers" size={15} color={colors.white} /></LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={st.miniKicker}>SHOP STATUS</Text>
                <Text style={[st.miniValue, { fontSize: 16 }]}>Approved</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <ShopPill label={subscription?.subscription_status || 'None'} variant={isSubscriptionActive ? 'emerald' : 'slate'} />
            </View>
          </ShopCard>
        </Rise>
      </View>

      {/* ===== STATS GRID ===== */}
      <View style={st.statsGrid}>
        {stats.map((s, i) => (
          <Rise key={s.label} delay={100 + i * 80} style={st.statWrap}>
            <View style={st.stat} testID={`stat-${s.label.toLowerCase().replace(' ', '-')}`}>
              <View style={[st.statOrb, { backgroundColor: s.tile.grad[1] }]} />
              <LinearGradient colors={s.tile.grad} style={st.statTile}><Ionicons name={s.icon} size={15} color={colors.white} /></LinearGradient>
              {s.raw ? <Text style={st.statValue}>{s.value}</Text> : <CountUp value={Number(s.value) || 0} style={st.statValue} />}
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          </Rise>
        ))}
      </View>

      {/* ===== SPIN + GIFTS ROW ===== */}
      {isSubscriptionActive && (
        <View style={{ gap: 12 }}>
          <Rise delay={300}>
            <LinearGradient colors={shop.plan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.spinCard} testID="spin-wheel-widget">
              <Float style={[st.blob, { top: -32, right: -32, width: 112, height: 112 }]} dur={5000}><View /></Float>
              <Float style={[st.blob, { bottom: 16, left: 16, width: 64, height: 64, backgroundColor: 'rgba(255,255,255,0.05)' }]} dur={4000} delay={1000}><View /></Float>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={st.spinIcon}><Ionicons name="sparkles" size={19} color={colors.white} /></View>
                <View>
                  <Text style={st.spinTitle}>Lucky Spin</Text>
                  <Text style={st.spinSub}>Win wallet credits & rewards</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <PressScale onPress={() => setSpinWheelOpen(true)}>
                  <View style={st.spinBtn} testID="open-spin-wheel-btn">
                    <Ionicons name="sparkles" size={14} color={colors.p800} />
                    <Text style={st.spinBtnText}>Spin Now</Text>
                  </View>
                </PressScale>
                <Text style={st.spinInfo}>{spinInfo?.free_spins || 0} free spins available</Text>
              </View>
            </LinearGradient>
          </Rise>

          <Rise delay={380}>
            <ShopCard testID="gifts-widget">
              <CardHead icon="gift" grad={shop.gift} title="Product Gifts" sub={`${shopGifts.length} active gift${shopGifts.length !== 1 ? 's' : ''}`} />
              {shopGifts.length > 0 ? (
                <View style={{ gap: 7 }}>
                  {shopGifts.slice(0, 3).map(g => (
                    <View key={g.id} style={st.giftRow}>
                      {g.gift_image ? <Image source={{ uri: img(g.gift_image) }} style={st.giftImg} /> : null}
                      <Text style={st.giftName} numberOfLines={1}>{g.gift_name}</Text>
                      <View style={st.giftActive}><Text style={st.giftActiveText}>Active</Text></View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted }}>Add gifts to attract more customers</Text>
              )}
              <SoftButton small label="Manage Gifts" onPress={() => navigation.navigate('ShopGifts')} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
            </ShopCard>
          </Rise>
        </View>
      )}

      {/* ===== ADVERTISING HUB CTA ===== */}
      <Rise delay={450}>
        <PressScale onPress={() => navigation.navigate('ShopAdvertising')} activeOpacity={0.93}>
          <LinearGradient colors={shop.adsHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.adsCard} testID="shop-advertising-hero-cta">
            <View style={[st.blob, { top: -48, right: -48, width: 200, height: 200, backgroundColor: 'rgba(244,114,182,0.3)' }]} />
            <View style={[st.blob, { bottom: -64, left: -48, width: 190, height: 190, backgroundColor: 'rgba(196,181,253,0.2)' }]} />
            <Float style={{ position: 'absolute', top: '50%', right: '33%' }} dur={3500}><View style={st.particleLg} /></Float>
            <Float style={{ position: 'absolute', bottom: '33%', right: '25%' }} dur={4000} delay={700}><View style={st.particleSm} /></Float>
            <Float style={{ position: 'absolute', top: '33%', left: '33%' }} dur={3000} delay={1400}><View style={st.particleSm} /></Float>
            <ShineSweep />
            <View style={{ flexDirection: 'row', gap: 13 }}>
              <View style={st.adsRocket}><Ionicons name="rocket" size={26} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <View style={st.adsBadge}>
                  <Ionicons name="sparkles" size={9} color={colors.white} />
                  <Text style={st.adsBadgeText}>ADVERTISING HUB</Text>
                </View>
                <Text style={st.adsTitle}>Grow your shop faster</Text>
                <Text style={st.adsSub}>Email blasts, Pay-Per-Click ads, product boosts & home-banner sponsorships — all paid from your wallet.</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
              {[{ icon: 'mail', l: 'Email' }, { icon: 'radio-button-on', l: 'PPC' }, { icon: 'ribbon', l: 'Banners' }].map(x => (
                <View key={x.l} style={st.adsPill}>
                  <Ionicons name={x.icon} size={15} color="rgba(255,255,255,0.9)" />
                  <Text style={st.adsPillText}>{x.l}</Text>
                </View>
              ))}
            </View>
            <PressScale onPress={() => navigation.navigate('ShopAdvertising')} style={{ marginTop: 12 }}>
              <View style={st.adsBtn} testID="shop-advertising-hero-cta-button">
                <Text style={st.adsBtnText}>Open Advertising Hub</Text>
                <Ionicons name="arrow-up-circle-outline" size={16} color={colors.p800} />
              </View>
            </PressScale>
          </LinearGradient>
        </PressScale>
      </Rise>

      {/* ===== ACTIVE PROMOTIONS ===== */}
      {promotions.length > 0 && (
        <Rise delay={500}>
          <ShopCard style={{ marginTop: 14 }} testID="active-promotions">
            <CardHead icon="megaphone" grad={['#fbbf24', '#f97316']} title="Active Promotions" />
            <View style={{ gap: 7 }}>
              {promotions.map((promo) => {
                const dl = Math.max(0, Math.ceil((new Date(promo.end_date) - new Date()) / (1000 * 60 * 60 * 24)));
                return (
                  <View key={promo.id} style={st.promoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.promoName}>{promo.product_name}</Text>
                      <Text style={st.promoMeta}>{dl}d left · {promo.views || 0} views · {promo.orders || 0} orders</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('ShopBoost')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} testID={`view-promotion-${promo.id}`}>
                      <Ionicons name="eye" size={12} color={colors.p500} />
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.p500 }}>View</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ShopCard>
        </Rise>
      )}

      {/* ===== LOW STOCK ALERT ===== */}
      {analytics?.low_stock_products && analytics.low_stock_products.length > 0 && (
        <Rise delay={550}>
          <ShopCard style={{ marginTop: 14, borderColor: '#fee2e2' }} testID="low-stock-products">
            <CardHead icon="warning" grad={['#ef4444', '#f43f5e']} title="Low Stock Alert" />
            <View style={{ gap: 7 }}>
              {analytics.low_stock_products.map((product) => (
                <Pulse key={product.id} min={0.75} dur={1100}>
                  <View style={st.lowRow} testID={`low-stock-product-${product.id}`}>
                    {product.images?.[0] ? <Image source={{ uri: img(product.images[0]) }} style={st.lowImg} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={st.promoName}>{product.name}</Text>
                      <Text style={st.lowUnits}>{product.stock} units left</Text>
                    </View>
                    <SoftButton small label="Restock" color="#dc2626" border="#fecaca" onPress={() => navigation.navigate('ShopProducts')} />
                  </View>
                </Pulse>
              ))}
            </View>
          </ShopCard>
        </Rise>
      )}

      {/* ===== QUICK ACTIONS GRID ===== */}
      <Rise delay={600}>
        <View style={st.qaGrid}>
          {quickActions.map((a) => (
            <PressScale key={a.label} onPress={a.go} style={st.qaWrap}>
              <View style={st.qa} testID={`shop-quickaction-${a.label.toLowerCase()}`}>
                <LinearGradient colors={a.grad} style={st.qaTile}><Ionicons name={a.icon} size={19} color={colors.white} /></LinearGradient>
                <Text style={st.qaLabel}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ position: 'absolute', top: 16, right: 12 }} />
              </View>
            </PressScale>
          ))}
        </View>
      </Rise>

      {/* ===== RECENT ORDERS ===== */}
      <Rise delay={650}>
        <ShopCard style={{ marginTop: 14 }}>
          <CardHead icon="cart" grad={shop.tiles.blue.grad} title="Recent Orders" sub={`${analytics?.total_orders || 0} total orders`}
            right={
              <TouchableOpacity onPress={() => navigation.navigate('ShopOrders')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: '#2563eb' }}>View All</Text>
                <Ionicons name="chevron-forward" size={11} color="#2563eb" />
              </TouchableOpacity>
            } />
          {recentOrders.length > 0 ? (
            <View style={{ gap: 7 }}>
              {recentOrders.map((order) => {
                const s = order.order_status;
                const [bg, fg] = s === 'delivered' ? ['#d1fae5', '#047857'] : s === 'shipped' ? ['#dbeafe', '#1d4ed8'] : s === 'cancelled' ? ['#fee2e2', '#b91c1c'] : ['#fef3c7', '#b45309'];
                return (
                  <View key={order.id} style={st.orderRow}>
                    <View style={[st.orderIcon, { backgroundColor: bg }]}><Ionicons name="cube" size={13} color={fg} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.promoName}>{order.guest_name || order.customer_name || 'Customer'}</Text>
                      <Text style={st.promoMeta}>{order.items?.length || 0} items · {new Date(order.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <Text style={st.orderAmt}>${(order.total_amount || 0).toFixed(2)}</Text>
                      <View style={[st.orderStatus, { backgroundColor: bg }]}><Text style={[st.orderStatusText, { color: fg }]}>{s}</Text></View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 26 }}>
              <Ionicons name="cart" size={38} color={colors.border} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 8 }}>No orders yet. Share your shop link to get started!</Text>
            </View>
          )}
        </ShopCard>
      </Rise>

      {/* ===== SHOP SCORE ===== */}
      <Rise delay={700}>
        <ShopCard style={{ marginTop: 14 }}>
          <CardHead icon="locate" grad={['#f43f5e', '#ec4899']} title="Shop Score" sub="Performance overview" />
          <View style={{ gap: 13 }}>
            {[
              { label: 'Products Listed', value: analytics?.products_count || 0, max: 50, color: '#3b82f6' },
              { label: 'Orders Completed', value: analytics?.total_orders || 0, max: 100, color: '#10b981' },
              { label: 'Active Promotions', value: promotions.length, max: 5, color: colors.p450 },
              { label: 'Stock Health', value: Math.max(0, (analytics?.products_count || 0) - (analytics?.low_stock_count || 0)), max: analytics?.products_count || 1, color: '#14b8a6' },
            ].map((m) => (
              <View key={m.label}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={st.scoreLabel}>{m.label}</Text>
                  <Text style={st.scoreVal}>{m.value}/{m.max}</Text>
                </View>
                <ScoreBar value={m.value} max={m.max} color={m.color} />
              </View>
            ))}
            <View style={st.scoreTotal}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text }}>Overall Score</Text>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: '#059669' }}>{overallScore}%</Text>
            </View>
          </View>
        </ShopCard>
      </Rise>

      {/* ===== GROWTH TIPS ===== */}
      <Rise delay={780}>
        <ShopCard style={{ marginTop: 14 }} testID="shop-suggestions">
          <CardHead icon="bulb" grad={['#fbbf24', '#eab308']} title="Growth Tips" sub="Actionable ideas to grow your sales" float />
          <View style={{ gap: 9 }}>
            {TIPS.map((tip, i) => (
              <View key={i} style={[st.tip, { borderLeftColor: tip.color }]}>
                <Text style={st.tipTitle}>{tip.title}</Text>
                <Text style={st.tipDesc}>{tip.desc}</Text>
              </View>
            ))}
          </View>
        </ShopCard>
      </Rise>
    </ShopScreenWrap>

    {/* ===== DIALOGS ===== */}
    {giftDialogOpen && (
      <GiftSheet open={giftDialogOpen} onOpenChange={setGiftDialogOpen} productId={null} productName="" onGiftSaved={fetchData} />
    )}
    <SpinWheelModal open={spinWheelOpen} onOpenChange={setSpinWheelOpen} spinInfo={spinInfo} navigation={navigation} onSpinComplete={() => fetchData()} />
    <SubscribeConfirmSheet
      open={confirmSubscribeOpen} onOpenChange={setConfirmSubscribeOpen}
      planName={planName} price={subscriptionPrice} walletBalance={walletBalance} features={planFeatures}
      onConfirm={handleSubscribeWithWallet} loading={subscribing}
    />
    <SubscribedWelcomeSheet open={welcomeBenefitsOpen} onOpenChange={setWelcomeBenefitsOpen} planName={planName} features={planFeatures} />
    <FirstLoginWelcomeSheet open={firstLoginOpen} onOpenChange={(v) => { if (!v) dismissFirstLogin(); }} data={firstLoginData} />

    {/* Fullscreen logo / cover preview */}
    <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
      <View style={st.viewerBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setViewer(null)} />
        <View style={st.viewerFrame}>
          <Image source={{ uri: img(viewer?.uri) }} style={st.viewerImg} resizeMode="contain" />
        </View>
        <View style={st.viewerLabel}>
          <Ionicons name="image-outline" size={13} color={colors.white} />
          <Text style={st.viewerLabelText}>{viewer?.label}</Text>
        </View>
        <TouchableOpacity onPress={() => setViewer(null)} style={st.viewerClose} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  coverWrap: { height: 150, overflow: 'hidden' },
  editCover: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, ...shadow.card },
  editCoverText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.text },
  heroBody: { paddingHorizontal: 16, paddingBottom: 16 },
  logoGlow: { borderRadius: 26, padding: 3, backgroundColor: 'rgba(45,212,191,0.45)' },
  logoBox: { width: 88, height: 88, borderRadius: 23, borderWidth: 4, borderColor: colors.white, overflow: 'hidden', backgroundColor: colors.white, ...shadow.emphasis },
  logoFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editLogo: { position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#059669', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  shopName: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.5, maxWidth: 200 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dbeafe', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  verifiedText: { fontFamily: fonts.bold, fontSize: 9, color: '#1d4ed8' },
  dateLine: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  blob: { position: 'absolute', width: 176, height: 176, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)' },
  subCard: { borderRadius: radius.xl, padding: 18, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  subIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  subTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 16.5, letterSpacing: -0.3 },
  subSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  planKicker: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.2 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  featureChipText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 10.5 },
  subPrice: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -0.5 },
  subPerMo: { fontSize: 13, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.8)' },
  subWallet: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 10.5, marginTop: 2 },
  subBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, ...shadow.card },
  subBtnText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#ea580c' },
  tintCard: { borderRadius: radius.xl, borderWidth: 1, padding: 16, overflow: 'hidden' },
  tintIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  tintTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  tintBody: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
  pctBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2.5 },
  pctBadgeText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 8.5, letterSpacing: 0.5 },
  exampleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: 'rgba(167,243,208,0.8)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  exampleText: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#047857' },
  tierBadge: { backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2.5 },
  tierBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: '#b45309', textTransform: 'uppercase', letterSpacing: 0.6 },
  loyKicker: { fontFamily: fonts.bold, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  loyValue: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink },
  alert: { flexDirection: 'row', gap: 12, borderRadius: radius.xl, borderWidth: 1, padding: 16, marginTop: 14 },
  alertIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontFamily: fonts.bold, fontSize: 13.5 },
  alertBody: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
  revenue: { borderRadius: radius.xl, padding: 20, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  revIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  revKicker: { color: '#a7f3d0', fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.4 },
  revValue: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 40, letterSpacing: -1 },
  revNote: { color: '#a7f3d0', fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  revTile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9 },
  revTileK: { color: '#a7f3d0', fontFamily: fonts.medium, fontSize: 8.5, letterSpacing: 0.6 },
  revTileV: { color: colors.white, fontFamily: fonts.bold, fontSize: 15, marginTop: 2 },
  particleLg: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.2)' },
  particleSm: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  miniTile: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  miniKicker: { fontFamily: fonts.bold, fontSize: 8.5, color: colors.textMuted, letterSpacing: 1 },
  miniValue: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink },
  miniFoot: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
  statWrap: { flexBasis: '30%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 13, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden', ...shadow.card },
  statOrb: { position: 'absolute', top: -12, right: -12, width: 52, height: 52, borderRadius: 26, opacity: 0.08 },
  statTile: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 9, ...shadow.card },
  statValue: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.ink },
  statLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  spinCard: { borderRadius: radius.xl, padding: 20, overflow: 'hidden', ...shadow.emphasis },
  spinIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  spinTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 15.5 },
  spinSub: { color: colors.p200, fontFamily: fonts.body, fontSize: 10 },
  spinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9, ...shadow.card },
  spinBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.p800 },
  spinInfo: { color: colors.p200, fontFamily: fonts.body, fontSize: 10 },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 8 },
  giftImg: { width: 28, height: 28, borderRadius: 8 },
  giftName: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  giftActive: { backgroundColor: '#d1fae5', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  giftActiveText: { fontFamily: fonts.semibold, fontSize: 8.5, color: '#059669' },
  adsCard: { borderRadius: radius.xl, padding: 20, marginTop: 14, overflow: 'hidden', ...shadow.emphasis },
  adsRocket: { width: 54, height: 54, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', ...shadow.emphasis },
  adsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 6 },
  adsBadgeText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 8.5, letterSpacing: 1.5 },
  adsTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19, letterSpacing: -0.4 },
  adsSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 11.5, marginTop: 4, lineHeight: 16 },
  adsPill: { flex: 1, alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, paddingVertical: 9 },
  adsPillText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  adsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, height: 42, ...shadow.emphasis },
  adsBtnText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.p800 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 11 },
  promoName: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  promoMeta: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  lowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(254,242,242,0.6)', borderRadius: radius.md, padding: 11 },
  lowImg: { width: 38, height: 38, borderRadius: 9 },
  lowUnits: { fontFamily: fonts.semibold, fontSize: 10, color: '#dc2626', marginTop: 1 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  qaWrap: { flexBasis: '47%', flexGrow: 1 },
  qa: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.borderLight, ...shadow.card },
  qaTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10, ...shadow.card },
  qaLabel: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 11 },
  orderIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  orderAmt: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  orderStatus: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  orderStatusText: { fontFamily: fonts.semibold, fontSize: 8.5, textTransform: 'capitalize' },
  scoreLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  scoreVal: { fontFamily: fonts.bold, fontSize: 10, color: colors.text },
  scoreTrack: { height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4 },
  scoreTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 12 },
  tip: { backgroundColor: colors.surfaceMuted, borderLeftWidth: 3, borderRadius: radius.md, padding: 12 },
  tipTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  tipDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(6,10,20,0.94)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  viewerFrame: { width: '92%', maxWidth: 460, aspectRatio: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  viewerImg: { width: '100%', height: '100%' },
  viewerLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  viewerLabelText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  viewerClose: { position: 'absolute', top: 52, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
});
