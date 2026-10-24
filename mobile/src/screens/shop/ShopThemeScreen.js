import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ScrollView, Image, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, Pulse, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import ConfirmSpendSheet from '../../components/shop/ConfirmSpendSheet';
import PurchaseConfirmSheet from '../../components/shop/PurchaseConfirmSheet';

const H = Dimensions.get('window').height;
const ACCENT_SWATCHES = [colors.s600, colors.p500, '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#0f172a'];

/* paint-roller sweep — a colored band rolls down the screen when a theme is applied */
function PaintSweep({ trigger, color }) {
  const a = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (trigger) {
      setVisible(true);
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => setVisible(false));
    }
  }, [trigger]); // eslint-disable-line
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 99, overflow: 'hidden' }]}>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, height: H * 0.55,
        opacity: a.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.85, 0.85, 0] }),
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-H * 0.6, H * 1.1] }) }],
      }}>
        <LinearGradient colors={['transparent', `${color}`, `${color}`, 'transparent']} style={{ flex: 1 }} />
        <View style={{ position: 'absolute', top: -8, left: 20, right: 20, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.85)', ...shadow.emphasis }} />
      </Animated.View>
    </View>
  );
}

/* a mini native product card tinted by the theme — real products rendered inside previews */
function ThemedProductCard({ product, tint, big }) {
  const price = product.discount_price || product.price;
  return (
    <View style={[tp.card, big && { width: '47%' }, { borderColor: `${tint}44` }]}>
      <View style={[tp.img, { backgroundColor: `${tint}14` }]}>
        {product.images?.[0] ? (
          <Image source={{ uri: img(product.images[0]) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Ionicons name="cube" size={22} color={`${tint}88`} />
        )}
        {product.discount_price ? (
          <View style={[tp.saleTag, { backgroundColor: tint }]}><Text style={tp.saleTagText}>SALE</Text></View>
        ) : null}
      </View>
      <View style={{ padding: 8 }}>
        <Text style={tp.name} numberOfLines={1}>{product.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <Text style={[tp.price, { color: tint }]}>${Number(price || 0).toFixed(2)}</Text>
          {product.discount_price ? <Text style={tp.oldPrice}>${Number(product.price || 0).toFixed(2)}</Text> : null}
        </View>
        {product.average_rating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <Ionicons name="star" size={9} color="#f59e0b" />
            <Text style={tp.rating}>{product.average_rating}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
const tp = StyleSheet.create({
  card: { width: 128, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, overflow: 'hidden', ...shadow.card },
  img: { height: 90, alignItems: 'center', justifyContent: 'center' },
  saleTag: { position: 'absolute', top: 5, left: 5, borderRadius: radius.badge, paddingHorizontal: 5, paddingVertical: 2 },
  saleTagText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 7, letterSpacing: 0.5 },
  name: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text },
  price: { fontFamily: fonts.extrabold, fontSize: 12.5 },
  oldPrice: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted, textDecorationLine: 'line-through' },
  rating: { fontFamily: fonts.medium, fontSize: 9.5, color: colors.textMuted },
});

const DEMO_PRODUCTS = [
  { id: 'demo-1', name: 'Sample Product 1', price: 49.99, discount_price: 39.99, images: [], average_rating: 4.5 },
  { id: 'demo-2', name: 'Sample Product 2', price: 89.0, images: [], average_rating: 4.8 },
  { id: 'demo-3', name: 'Sample Product 3', price: 129.99, discount_price: 99.99, images: [], average_rating: 4.2 },
  { id: 'demo-4', name: 'Sample Product 4', price: 29.99, images: [], average_rating: 4.6 },
];

export default function ShopThemeScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [applying, setApplying] = useState(null);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [accentColor, setAccentColor] = useState('');
  const [shopProducts, setShopProducts] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDetails, setConfirmDetails] = useState({});
  const [confirmSpendOpen, setConfirmSpendOpen] = useState(false);
  const [pendingPurchaseTheme, setPendingPurchaseTheme] = useState(null);
  const [themeSalePercent, setThemeSalePercent] = useState(0);
  const [sweep, setSweep] = useState(0);
  const [sweepColor, setSweepColor] = useState(colors.p450);

  const fetchProducts = useCallback(async () => {
    try { const { data: d } = await api.shop.getProducts(); setShopProducts((d || []).slice(0, 6)); } catch {}
  }, []);
  const fetchThemes = useCallback(async () => {
    try {
      const { data: result } = await api.shop.getStorefrontThemes();
      setData(result);
      setAccentColor(prev => prev || result.theme_accent || '');
      try {
        const { data: saleData } = await api.themeSale.get();
        setThemeSalePercent(saleData.theme_sale_percent || 0);
      } catch {}
    } catch (err) { toast.error('Failed to load themes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchThemes(); fetchProducts(); }, [fetchThemes, fetchProducts]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchThemes(); setRefreshing(false); }, [fetchThemes]);

  if (loading || !data) {
    return <View style={st.center}><Spinner size={34} color={colors.p450} /></View>;
  }

  const { themes, current_theme, free_unlocks_remaining, free_theme_credits = 0, wallet_balance } = data;

  const handlePurchase = (themeKey) => {
    const theme = data.themes?.find(t => t.key === themeKey);
    const basePrice = theme?.price_usd || theme?.price || 0;
    const discountedPrice = themeSalePercent > 0 ? Math.round(basePrice * (1 - themeSalePercent / 100) * 100) / 100 : basePrice;
    const hasFree = (free_unlocks_remaining > 0) || (free_theme_credits > 0);
    const cost = hasFree ? 0 : discountedPrice;
    setPendingPurchaseTheme({ key: themeKey, name: theme?.name || themeKey, cost, color: theme?.preview_color || colors.p450 });
    setConfirmSpendOpen(true);
  };

  const executePurchase = async () => {
    if (!pendingPurchaseTheme) return;
    const { key: themeKey, name, cost, color } = pendingPurchaseTheme;
    setConfirmSpendOpen(false);
    setPurchasing(themeKey);
    try {
      const { data: result } = await api.shop.purchaseTheme({ theme_key: themeKey });
      // Auto-apply the theme after purchase (silently ignore apply failures)
      try { await api.shop.applyTheme({ theme_key: themeKey, theme_accent: accentColor }); } catch (applyErr) {}
      setSweepColor(color); setSweep(k => k + 1); notifySuccess();
      setConfirmDetails({
        themeName: name,
        amount: cost,
        message: result.message ? `${result.message} Theme has been applied automatically!` : 'Theme purchased and applied successfully!',
      });
      setTimeout(() => setConfirmOpen(true), 700);
      fetchThemes();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to purchase theme'); }
    finally { setPurchasing(null); setPendingPurchaseTheme(null); }
  };

  const handleApply = async (themeKey) => {
    setApplying(themeKey);
    try {
      await api.shop.applyTheme({ theme_key: themeKey, theme_accent: accentColor });
      const theme = themes.find(t => t.key === themeKey);
      setSweepColor(theme?.preview_color || colors.p450); setSweep(k => k + 1); notifySuccess();
      setConfirmDetails({ themeName: themeKey, message: `Theme "${themeKey}" applied to your storefront!` });
      setTimeout(() => setConfirmOpen(true), 700);
      fetchThemes();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to apply theme'); }
    finally { setApplying(null); }
  };

  const previewObj = themes.find(t => t.key === previewTheme);
  const previewProducts = shopProducts.length > 0 ? shopProducts : DEMO_PRODUCTS;

  return (
    <>
    <ShopScreenWrap wash={shop.washSpin} refreshing={refreshing} onRefresh={onRefresh} testID="shop-theme-page">
      {/* Header — violet-500 -> purple-600 */}
      <Rise duration={500} distance={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <LinearGradient colors={[colors.p450, colors.p600]} style={st.headerIcon}><Ionicons name="color-palette" size={22} color={colors.white} /></LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Storefront Theme</Text>
            <Text style={st.headerSub}>Customize how your public shop page looks to customers</Text>
          </View>
        </View>
      </Rise>

      {/* Info banner */}
      <Rise delay={80}>
        <LinearGradient colors={[colors.p50, colors.p50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.infoBanner}>
          <View style={st.infoRow}>
            <Ionicons name="eye" size={13} color={colors.p500} />
            <Text style={st.infoText}>Current: <Text style={{ fontFamily: fonts.extrabold }}>{themes.find(t => t.key === current_theme)?.name || 'Classic Grid'}</Text></Text>
          </View>
          <View style={st.infoRow}>
            <Ionicons name="sparkles" size={13} color="#f59e0b" />
            <Text style={st.infoText}>{free_unlocks_remaining > 0 ? `${free_unlocks_remaining} free unlock available!` : 'All free unlocks used'}</Text>
          </View>
          {free_theme_credits > 0 && (
            <Pulse>
              <View style={st.creditsBadge} testID="free-theme-credits-badge">
                <Ionicons name="sparkles" size={13} color="#f06a92" />
                <Text style={st.creditsBadgeText}>{free_theme_credits} free theme from Spin Wheel!</Text>
              </View>
            </Pulse>
          )}
          <View style={st.infoRow}>
            <Ionicons name="logo-usd" size={13} color="#10b981" />
            <Text style={st.infoText}>Wallet: ${(wallet_balance || 0).toFixed(2)}</Text>
          </View>
          {themeSalePercent > 0 && (
            <Pulse>
              <View style={[st.creditsBadge, { backgroundColor: '#fee2e2' }]}>
                <Text style={[st.creditsBadgeText, { color: '#b91c1c' }]}>{themeSalePercent}% OFF all themes!</Text>
              </View>
            </Pulse>
          )}
        </LinearGradient>
      </Rise>

      {/* Accent color */}
      <Rise delay={140}>
        <View style={st.accentCard}>
          <Text style={st.accentLabel}>Accent Color:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, alignItems: 'center' }}>
            {ACCENT_SWATCHES.map(sw => (
              <TouchableOpacity key={sw} onPress={() => setAccentColor(sw)}
                style={[st.swatch, { backgroundColor: sw }, accentColor === sw && st.swatchOn]}>
                {accentColor === sw && <Ionicons name="checkmark" size={12} color={colors.white} />}
              </TouchableOpacity>
            ))}
            <TextInput value={accentColor} onChangeText={setAccentColor} placeholder={colors.s600} autoCapitalize="none"
              placeholderTextColor={colors.textMuted} style={st.hexInput} />
          </ScrollView>
        </View>
      </Rise>

      {/* Theme grid — sorted price high to low */}
      <View style={st.grid}>
        {[...themes].sort((a, b) => (b.price_usd || 0) - (a.price_usd || 0)).map((theme, i) => {
          const isCurrent = theme.key === current_theme;
          const isLocked = !theme.is_unlocked && !theme.is_default;
          const canApply = theme.is_unlocked || theme.is_default;
          const basePrice = theme.price_usd || 0;
          const discountedPrice = themeSalePercent > 0 && basePrice > 0 ? Math.round(basePrice * (1 - themeSalePercent / 100) * 100) / 100 : basePrice;
          const hasDiscount = themeSalePercent > 0 && basePrice > 0;
          const c = theme.preview_color || colors.p450;
          return (
            <Rise key={theme.key} delay={Math.min(500, 200 + i * 60)} style={st.gridItem}>
              <View style={[st.themeCard, isCurrent && { borderColor: colors.p450, borderWidth: 2, ...shadow.violetGlow }, isLocked && { opacity: 0.85 }]} testID={`shop-theme-${theme.key}`}>
                {/* preview header with a real mini product card inside */}
                <LinearGradient colors={[`${c}33`, `${c}66`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.themePreview}>
                  <View style={{ transform: [{ scale: 0.8 }] }}>
                    <ThemedProductCard product={previewProducts[i % previewProducts.length]} tint={c} />
                  </View>
                  {isCurrent && (
                    <View style={st.activeTag}><Ionicons name="checkmark" size={9} color={colors.white} /><Text style={st.activeTagText}>Active</Text></View>
                  )}
                  {isLocked && <View style={st.lockDot}><Ionicons name="lock-closed" size={11} color={colors.white} /></View>}
                  {!isLocked && !isCurrent && theme.is_unlocked && (
                    <View style={[st.lockDot, { backgroundColor: 'rgba(16,185,129,0.85)' }]}><Ionicons name="lock-open" size={11} color={colors.white} /></View>
                  )}
                </LinearGradient>
                <View style={{ padding: 11 }}>
                  <Text style={st.themeName}>{theme.name}</Text>
                  <Text style={st.themeDesc} numberOfLines={2}>{theme.description}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {theme.best_for ? <View style={st.badgeOutline}><Text style={st.badgeOutlineText}>{theme.best_for}</Text></View> : null}
                    {basePrice > 0 && isLocked && hasDiscount && (
                      <>
                        <View style={st.badgeGrey}><Text style={[st.badgeGreyText, { textDecorationLine: 'line-through', opacity: 0.6 }]}>${basePrice}</Text></View>
                        <View style={[st.badgeGrey, { backgroundColor: '#fee2e2' }]}><Text style={[st.badgeGreyText, { color: '#b91c1c' }]}>${discountedPrice} ({themeSalePercent}% OFF)</Text></View>
                      </>
                    )}
                    {basePrice > 0 && isLocked && !hasDiscount && (
                      <View style={st.badgeGrey}><Text style={st.badgeGreyText}>${basePrice}</Text></View>
                    )}
                    {free_unlocks_remaining > 0 && isLocked && (
                      <View style={[st.badgeGrey, { backgroundColor: '#fef3c7' }]}><Text style={[st.badgeGreyText, { color: '#b45309' }]}>FREE</Text></View>
                    )}
                  </View>
                  {/* actions */}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => setPreviewTheme(theme.key)} style={st.previewBtn} testID={`preview-${theme.key}`}>
                      <Ionicons name="eye" size={12} color={colors.textSecondary} />
                      <Text style={st.previewBtnText}>Preview</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      {isCurrent ? (
                        <View style={[st.previewBtn, { justifyContent: 'center' }]}><Ionicons name="checkmark" size={12} color={colors.textMuted} /><Text style={st.previewBtnText}>Active</Text></View>
                      ) : canApply ? (
                        <PressScale onPress={() => handleApply(theme.key)} disabled={applying === theme.key}>
                          <View style={st.applyBtn} testID={`apply-${theme.key}`}>
                            {applying === theme.key ? <Spinner size={12} /> : <Ionicons name="color-palette" size={12} color={colors.white} />}
                            <Text style={st.applyText}>Apply</Text>
                          </View>
                        </PressScale>
                      ) : (
                        <PressScale onPress={() => handlePurchase(theme.key)} disabled={purchasing === theme.key}>
                          <View style={st.unlockBtn} testID={`unlock-${theme.key}`}>
                            {purchasing === theme.key ? <Spinner size={12} /> : <Ionicons name="lock-open" size={12} color={colors.white} />}
                            <Text style={st.applyText}>{free_unlocks_remaining > 0 || free_theme_credits > 0 ? 'Free' : `$${hasDiscount ? discountedPrice : basePrice}`}</Text>
                          </View>
                        </PressScale>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </Rise>
          );
        })}
      </View>
    </ShopScreenWrap>

    <PaintSweep trigger={sweep} color={sweepColor} />

    {/* Full-screen theme preview with your actual products */}
    <Modal visible={!!previewTheme} animationType="slide" onRequestClose={() => setPreviewTheme(null)}>
      <PreviewScreen theme={previewObj} products={previewProducts} onClose={() => setPreviewTheme(null)} />
    </Modal>

    {/* Purchase confirmation (confetti) */}
    <PurchaseConfirmSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} type="theme" details={confirmDetails} />

    {/* Confirm spend — emerald */}
    <ConfirmSpendSheet
      open={confirmSpendOpen}
      onClose={() => { setConfirmSpendOpen(false); setPendingPurchaseTheme(null); }}
      onConfirm={executePurchase}
      title="Confirm Theme Purchase"
      description="This theme will be unlocked for your storefront"
      icon="color-palette"
      iconGradient={['#10b981', '#14b8a6']}
      walletBalance={wallet_balance || 0}
      spendAmount={pendingPurchaseTheme?.cost || 0}
      itemName={pendingPurchaseTheme?.name || ''}
      confirmLabel="Purchase Theme"
      confirmGradient={['#10b981', '#14b8a6']}
      loading={!!purchasing}
    />
    </>
  );
}

/* full-screen preview: mini hero + your products grid, tinted by the theme */
function PreviewScreen({ theme, products, onClose }) {
  const insets = useSafeAreaInsets();
  const c = theme?.preview_color || colors.p450;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }} testID="theme-preview-dialog">
      <View style={[st.previewHead, { paddingTop: insets.top + 10 }]}>
        <Ionicons name="color-palette" size={17} color={colors.p500} />
        <Text style={st.previewHeadTitle} numberOfLines={1}>Preview: {theme?.name || ''}</Text>
        <TouchableOpacity onPress={onClose} style={st.previewClose}><Ionicons name="close" size={18} color={colors.text} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <LinearGradient colors={[c, `${c}bb`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.previewHero}>
          <Text style={st.previewHeroTitle}>Your Store Name</Text>
          <Text style={st.previewHeroSub}>Preview of how your products will look</Text>
        </LinearGradient>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
          {products.map(p => <ThemedProductCard key={p.id} product={p} tint={c} big />)}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  headerIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...shadow.violetGlow },
  headerTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  headerSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  infoBanner: { borderWidth: 1, borderColor: colors.p200, borderRadius: radius.md, padding: 13, marginTop: 14, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.p925 },
  creditsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#fae8ff', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 },
  creditsBadgeText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#be3a5c' },
  accentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 11, marginTop: 12, ...shadow.card },
  accentLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  swatch: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  swatchOn: { borderWidth: 2, borderColor: colors.ink },
  hexInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 6, fontFamily: fonts.body, fontSize: 12, color: colors.text, minWidth: 88 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  themeCard: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  themePreview: { height: 130, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  activeTag: { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.p450, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3 },
  activeTagText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 8.5 },
  lockDot: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center' },
  themeName: { fontFamily: fonts.extrabold, fontSize: 13.5, color: colors.ink },
  themeDesc: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 2, minHeight: 26 },
  badgeOutline: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  badgeOutlineText: { fontFamily: fonts.medium, fontSize: 8, color: colors.textSecondary },
  badgeGrey: { backgroundColor: colors.borderLight, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  badgeGreyText: { fontFamily: fonts.bold, fontSize: 8, color: colors.textSecondary },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 8 },
  previewBtnText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.textSecondary },
  applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.p500, borderRadius: radius.sm, paddingVertical: 8 },
  unlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#f59e0b', borderRadius: radius.sm, paddingVertical: 8 },
  applyText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16, paddingBottom: 12 },
  previewHeadTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink },
  previewClose: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  previewHero: { borderRadius: radius.md, padding: 20 },
  previewHeroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19 },
  previewHeroSub: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
});
