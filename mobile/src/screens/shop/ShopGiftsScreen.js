import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Animated as RNAnimated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition, FadeIn, ZoomOut } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, PressScale, Spinner, toast } from '../../components/shop/ShopKit';
import GiftSheet from '../../components/shop/GiftSheet';

/* ribbon-tying micro-animation shown after a gift is saved */
function RibbonBurst({ visible, onDone }) {
  const scale = useRef(new RNAnimated.Value(0)).current;
  const bow = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      scale.setValue(0); bow.setValue(0);
      RNAnimated.sequence([
        RNAnimated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        RNAnimated.timing(bow, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        RNAnimated.delay(350),
        RNAnimated.timing(scale, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => onDone && onDone());
    }
  }, [visible]); // eslint-disable-line
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={rb.overlay}>
      <RNAnimated.View style={{ transform: [{ scale }] }}>
        <LinearGradient colors={shop.gift} style={rb.circle}>
          <Ionicons name="gift" size={34} color={colors.white} />
          {/* the bow "ties" — ribbon swings in over the gift */}
          <RNAnimated.View style={[rb.bow, {
            opacity: bow,
            transform: [
              { rotate: bow.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
              { scale: bow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            ],
          }]}>
            <Ionicons name="ribbon" size={22} color="#fce883" />
          </RNAnimated.View>
        </LinearGradient>
      </RNAnimated.View>
    </View>
  );
}
const rb = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  circle: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', shadowColor: '#ec4899', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  bow: { position: 'absolute', top: -8, right: -4 },
});

export default function ShopGiftsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [removingIds, setRemovingIds] = useState([]); // shrink-fade exits
  const [ribbon, setRibbon] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [prodRes, giftRes] = await Promise.allSettled([api.shop.getProducts(), api.shopGifts.getAll()]);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.data || []);
      if (giftRes.status === 'fulfilled') setGifts(giftRes.value.data?.gifts || []);
    } catch (e) {} finally { setLoading(false); }
  };
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []);

  const handleRemoveGift = async (productId) => {
    setRemovingIds(prev => [...prev, productId]);
    try {
      await api.shopGifts.removeGift(productId);
      toast.success('Gift removed from product');
      setGifts(prev => prev.filter(g => g.product_id !== productId));
      setRemovingIds(prev => prev.filter(x => x !== productId));
    } catch (e) {
      toast.error('Failed to remove gift');
      setRemovingIds(prev => prev.filter(x => x !== productId));
    }
  };

  const giftsMap = {};
  gifts.forEach(g => { giftsMap[g.product_id] = g; });
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const productsWithoutGifts = products.filter(p => !giftsMap[p.id]);

  const openGiftFor = (id, name) => { setSelectedProductId(id); setSelectedProductName(name); setGiftDialogOpen(true); };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg }}>
        <Spinner size={30} color="#059669" />
      </View>
    );
  }

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header — pink-500 -> rose-500 world */}
      <Rise duration={500} distance={0}>
        <View style={st.headRow}>
          <LinearGradient colors={shop.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.headTile}>
            <Ionicons name="gift" size={22} color={colors.white} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={st.headTitle}>Product Gifts</Text>
            <Text style={st.headSub}>Attach free gifts to products to attract more customers</Text>
          </View>
          <PressScale onPress={() => {
            if (productsWithoutGifts.length > 0) openGiftFor(null, '');
            else toast.info('All products already have gifts attached');
          }}>
            <LinearGradient colors={shop.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.addBtn} testID="add-gift-top-btn">
              <Ionicons name="add" size={15} color={colors.white} />
              <Text style={st.addBtnText}>Add Gift</Text>
            </LinearGradient>
          </PressScale>
        </View>
      </Rise>

      {/* Active Gifts */}
      {gifts.length > 0 && (
        <Rise delay={80}>
          <View style={st.giftsCard}>
            <View style={st.giftsHead}>
              <Ionicons name="gift" size={14} color="#9d174d" />
              <Text style={st.giftsHeadText}>Active Gifts ({gifts.length})</Text>
            </View>
            <View style={{ padding: 10, gap: 8 }}>
              {gifts.filter(g => !removingIds.includes(g.product_id)).map(g => {
                const product = products.find(p => p.id === g.product_id);
                return (
                  <Animated.View key={g.id || g.product_id} layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={ZoomOut.duration(280)}>
                    <View style={st.giftRow}>
                      {g.gift_image ? (
                        <Image source={{ uri: img(g.gift_image) }} style={st.giftImg} />
                      ) : (
                        <View style={[st.giftImg, { backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="gift" size={15} color="#f9a8d4" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={st.giftName} numberOfLines={1}>{g.gift_name}</Text>
                        <Text style={st.giftFor} numberOfLines={1}>For: {product?.name || `${(g.product_id || '').substring(0, 12)}...`}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                          <View style={st.typeChip}>
                            <Text style={st.typeChipText}>{g.gift_type === 'existing_product' ? 'Existing Product' : 'Custom Gift'}</Text>
                          </View>
                          {g.gift_stock !== null && g.gift_stock !== undefined ? (
                            <View style={[st.stockChip, {
                              backgroundColor: g.gift_stock <= 0 ? '#fee2e2' : g.gift_stock <= 5 ? '#fef3c7' : '#d1fae5',
                            }]}>
                              <Text style={[st.stockChipText, {
                                color: g.gift_stock <= 0 ? '#b91c1c' : g.gift_stock <= 5 ? '#b45309' : '#047857',
                              }]}>{g.gift_stock}{g.gift_stock_used ? ` (${g.gift_stock_used} used)` : ''}</Text>
                            </View>
                          ) : (
                            <Text style={st.unlimited}>Unlimited</Text>
                          )}
                          {g.created_at ? <Text style={st.created}>{new Date(g.created_at).toLocaleDateString()}</Text> : null}
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <TouchableOpacity onPress={() => openGiftFor(g.product_id, product?.name || '')} style={st.iconBtn}>
                          <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleRemoveGift(g.product_id)} style={st.iconBtn}>
                          <Ionicons name="trash" size={15} color={colors.saleAlt} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </Rise>
      )}

      {/* Search */}
      <Rise delay={140}>
        <View style={st.search}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search products..."
            placeholderTextColor={colors.textMuted} style={st.searchInput} />
        </View>
      </Rise>

      {/* Products grid */}
      <View style={st.grid}>
        {filteredProducts.map(product => {
          const hasGift = !!giftsMap[product.id];
          const image = product.images?.[0];
          // Customer-facing price WITH commission (what the customer pays)
          const customerPrice = product.customer_price || product.price;
          const customerDiscount = product.customer_discount_price || product.discount_price;
          const displayPrice = customerDiscount || customerPrice;
          return (
            <Animated.View key={product.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn} style={st.gridItem}>
              <View style={[st.prodCard, hasGift && { borderColor: '#f9a8d4', borderWidth: 2 }]}>
                <View style={st.prodImgWrap}>
                  {image ? (
                    <Image source={{ uri: img(image) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="cube" size={28} color={colors.border} />
                    </View>
                  )}
                  {hasGift && (
                    <View style={st.giftBadge}>
                      <Ionicons name="gift" size={9} color={colors.white} />
                      <Text style={st.giftBadgeText}>Gift Active</Text>
                    </View>
                  )}
                </View>
                <View style={{ padding: 10 }}>
                  <Text style={st.prodName} numberOfLines={1}>{product.name}</Text>
                  <Text style={st.prodPrice}>${Number(displayPrice || 0).toFixed(2)}</Text>
                  <PressScale onPress={() => openGiftFor(product.id, product.name)}>
                    {hasGift ? (
                      <View style={st.editGiftBtn} testID={`add-gift-${product.id}`}>
                        <Ionicons name="gift" size={12} color="#be185d" />
                        <Text style={[st.giftBtnText, { color: '#be185d' }]}>Edit Gift</Text>
                      </View>
                    ) : (
                      <LinearGradient colors={shop.gift} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.addGiftBtn} testID={`add-gift-${product.id}`}>
                        <Ionicons name="gift" size={12} color={colors.white} />
                        <Text style={[st.giftBtnText, { color: colors.white }]}>Add Gift</Text>
                      </LinearGradient>
                    )}
                  </PressScale>
                </View>
              </View>
            </Animated.View>
          );
        })}
        {filteredProducts.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="gift-outline" size={40} color={colors.border} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 10 }}>No products found</Text>
          </View>
        )}
      </View>
    </ShopScreenWrap>

    <RibbonBurst visible={ribbon} onDone={() => setRibbon(false)} />

    <GiftSheet
      open={giftDialogOpen}
      onOpenChange={setGiftDialogOpen}
      productId={selectedProductId}
      productName={selectedProductName}
      products={productsWithoutGifts}
      onGiftSaved={() => { setRibbon(true); notifySuccess(); fetchData(); }}
    />
    </>
  );
}

const st = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headTile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#ec4899', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  headTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, letterSpacing: -0.4 },
  headSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10, shadowColor: '#ec4899', shadowOpacity: 0.3, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  addBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  giftsCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: 14, ...shadow.card },
  giftsHead: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fdf2f8', borderBottomWidth: 1, borderBottomColor: colors.borderLight, padding: 13 },
  giftsHeadText: { fontFamily: fonts.bold, fontSize: 13, color: '#9d174d' },
  giftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10 },
  giftImg: { width: 44, height: 44, borderRadius: 11 },
  giftName: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  giftFor: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textSecondary, marginTop: 1 },
  typeChip: { backgroundColor: colors.p100, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  typeChipText: { fontFamily: fonts.semibold, fontSize: 9, color: colors.p800 },
  stockChip: { borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  stockChipText: { fontFamily: fonts.semibold, fontSize: 9 },
  unlimited: { fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted },
  created: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
  iconBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginTop: 14 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  prodCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  prodImgWrap: { aspectRatio: 1, backgroundColor: colors.surfaceMuted },
  giftBadge: { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ec4899', borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 4 },
  giftBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8 },
  prodName: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  prodPrice: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1, marginBottom: 8 },
  editGiftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#fbcfe8', borderRadius: radius.sm, paddingVertical: 8 },
  addGiftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.sm, paddingVertical: 8 },
  giftBtnText: { fontFamily: fonts.bold, fontSize: 10.5 },
});
