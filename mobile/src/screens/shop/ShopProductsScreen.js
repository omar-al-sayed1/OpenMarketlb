import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Animated as RNAnimated, Easing, ScrollView } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition, FadeIn, FlipOutXUp } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, CountUp, PressScale, ShopPill, toast } from '../../components/shop/ShopKit';
import ProductFormSheet from '../../components/shop/ProductFormSheet';
import GiftSheet from '../../components/shop/GiftSheet';
import BoostSheet from '../../components/shop/BoostSheet';
import { EMPTY_FORM, buildProductPayload, productToForm } from '../../lib/productForm';
import { useReveal } from '../../lib/useReveal';
import { SkeletonGrid } from '../../components/ui';

const HEADER_GRAD = [colors.p500, '#f06a92', '#f43f5e']; // violet-600 -> fuchsia-600 -> rose-500

const STOCK_FILTERS = [
  { v: 'all', l: 'All Stock' }, { v: 'in_stock', l: 'In Stock' }, { v: 'low_stock', l: 'Low Stock' }, { v: 'out_of_stock', l: 'Out of Stock' },
];
const STATUS_FILTERS = [{ v: 'all', l: 'All' }, { v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }];
const SORTS = [
  { v: 'newest', l: 'Newest First' }, { v: 'oldest', l: 'Oldest First' },
  { v: 'name_asc', l: 'Name A-Z' }, { v: 'name_desc', l: 'Name Z-A' },
  { v: 'price_asc', l: 'Price Low-High' }, { v: 'price_desc', l: 'Price High-Low' },
  { v: 'stock_asc', l: 'Stock Low-High' }, { v: 'stock_desc', l: 'Stock High-Low' },
];

/* chip select row (native stand-in for the web <Select>) */
function ChipSelect({ options, value, onChange, accent = colors.p500, testID }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID={testID}>
      {options.map(o => (
        <TouchableOpacity key={o.v} onPress={() => onChange(o.v)}
          style={[st.chip, value === o.v && { backgroundColor: accent, borderColor: accent }]}>
          <Text style={[st.chipText, value === o.v && { color: colors.white }]}>{o.l}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function ShopProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesFlat, setCategoriesFlat] = useState([]);
  const [shopCategoryIds, setShopCategoryIds] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [stockFilter, setStockFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [commissionRate, setCommissionRate] = useState(10);
  const [commissionType, setCommissionType] = useState('on_customer');
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftProductId, setGiftProductId] = useState(null);
  const [giftProductName, setGiftProductName] = useState('');
  const [boostTarget, setBoostTarget] = useState(null);
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [tierInfo, setTierInfo] = useState(null);
  const [productGifts, setProductGifts] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAccent, setAiAccent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]); // rows folding away
  const [variantToggles, setVariantToggles] = useState({
    variant_color_enabled: true, variant_size_enabled: true, variant_shape_enabled: true, variant_type_enabled: true,
  });
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const filterAnim = useRef(new RNAnimated.Value(0)).current;
  const meterAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    fetchProducts(); fetchCategories(); fetchCommissionRate(); fetchTierAndGifts(); fetchShopProfile(); fetchVariantToggles();
  }, []); // eslint-disable-line

  /* filter panel slides + fades */
  useEffect(() => {
    RNAnimated.timing(filterAnim, { toValue: showFilters ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [showFilters, filterAnim]);

  const fetchProducts = async () => {
    try { const { data } = await api.shop.getProducts(); setProducts(data); } catch (e) {}
  };
  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getTree();
      setCategories(data);
      const flat = [];
      const walk = (nodes) => (nodes || []).forEach(n => { flat.push({ id: n.id, name: n.name }); if (n.children) walk(n.children); });
      walk(data);
      setCategoriesFlat(flat);
    } catch (e) {}
  };
  const fetchShopProfile = async () => {
    try { const { data } = await api.shop.getProfile(); setShopCategoryIds(data?.category_ids || []); } catch {}
  };
  const fetchVariantToggles = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setVariantToggles({
        variant_color_enabled: data?.variant_color_enabled !== false,
        variant_size_enabled: data?.variant_size_enabled !== false,
        variant_shape_enabled: data?.variant_shape_enabled !== false,
        variant_type_enabled: data?.variant_type_enabled !== false,
      });
    } catch {}
  };
  const fetchCommissionRate = async () => {
    try {
      const { data: profileData } = await api.shop.getProfile();
      if (profileData?.commission_percentage !== null && profileData?.commission_percentage !== undefined) setCommissionRate(profileData.commission_percentage);
      if (profileData?.commission_type) setCommissionType(profileData.commission_type);
      if (profileData?.commission_percentage === null || profileData?.commission_percentage === undefined) {
        const { data: tierData } = await api.shopTier.getInfo();
        if (tierData?.commission_rate) setCommissionRate(tierData.commission_rate);
      }
    } catch (error) {
      try { const { data } = await api.admin.getPlatformSettings(); setCommissionRate(data.commission_percentage || 10); } catch {}
    }
  };
  const fetchTierAndGifts = async () => {
    try {
      const [tierRes, giftsRes] = await Promise.allSettled([api.shopTier.getInfo(), api.shopGifts.getAll()]);
      if (tierRes.status === 'fulfilled') setTierInfo(tierRes.value.data || null);
      if (giftsRes.status === 'fulfilled') {
        const gifts = giftsRes.value.data?.gifts || [];
        const gMap = {};
        gifts.forEach(g => { gMap[g.product_id] = g; });
        setProductGifts(gMap);
      }
    } catch (e) {}
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchTierAndGifts()]);
    setRefreshing(false);
  }, []);

  /* ---- pricing helpers (ported verbatim) ---- */
  const calculateCustomerPrice = (price) => {
    if (!price || isNaN(price)) return 0;
    const p = parseFloat(price);
    const rate = commissionRate / 100;
    if (commissionType === 'on_shop') return p.toFixed(2);
    if (commissionType === 'half_half') return (p * (1 + rate / 2)).toFixed(2);
    return (p * (1 + rate)).toFixed(2);
  };
  const calculateShopRevenue = (price) => {
    if (!price || isNaN(price)) return 0;
    const p = parseFloat(price);
    const rate = commissionRate / 100;
    if (commissionType === 'on_customer') return p.toFixed(2);
    if (commissionType === 'half_half') return (p * (1 - rate / 2)).toFixed(2);
    return (p * (1 - rate)).toFixed(2);
  };
  const getCommissionTypeLabel = () => {
    if (commissionType === 'on_shop') return 'On Shop';
    if (commissionType === 'half_half') return 'Half/Half';
    return 'On Customer';
  };

  /* ---- filtering + sorting (ported verbatim) ---- */
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(p => (p.category_ids || []).includes(categoryFilter) || p.category_id === categoryFilter);
    }
    if (priceMin !== '' && !isNaN(parseFloat(priceMin))) filtered = filtered.filter(p => (p.customer_price || p.price || 0) >= parseFloat(priceMin));
    if (priceMax !== '' && !isNaN(parseFloat(priceMax))) filtered = filtered.filter(p => (p.customer_price || p.price || 0) <= parseFloat(priceMax));
    if (stockFilter === 'in_stock') filtered = filtered.filter(p => p.stock > 0);
    else if (stockFilter === 'out_of_stock') filtered = filtered.filter(p => p.stock === 0);
    else if (stockFilter === 'low_stock') filtered = filtered.filter(p => p.stock > 0 && p.stock <= 10);
    if (statusFilter === 'active') filtered = filtered.filter(p => p.is_active);
    else if (statusFilter === 'inactive') filtered = filtered.filter(p => !p.is_active);
    switch (sortBy) {
      case 'name_asc': filtered.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': filtered.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'price_asc': filtered.sort((a, b) => (a.discount_price || a.price) - (b.discount_price || b.price)); break;
      case 'price_desc': filtered.sort((a, b) => (b.discount_price || b.price) - (a.discount_price || a.price)); break;
      case 'stock_asc': filtered.sort((a, b) => a.stock - b.stock); break;
      case 'stock_desc': filtered.sort((a, b) => b.stock - a.stock); break;
      case 'oldest': filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      case 'newest': default: filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    }
    return filtered;
  }, [products, searchQuery, sortBy, stockFilter, statusFilter, categoryFilter, priceMin, priceMax]);

  // Rows actually rendered (minus ones folding away on delete), revealed in batches.
  const renderProducts = useMemo(() => filteredProducts.filter(p => !deletingIds.includes(p.id)), [filteredProducts, deletingIds]);
  const { visible: visibleProducts, hasMore: moreProducts, revealing: revealingProducts, revealMore: revealProducts } = useReveal(renderProducts, 8);

  const productStats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.is_active).length,
    lowStock: products.filter(p => p.stock > 0 && p.stock <= 10).length,
    outOfStock: products.filter(p => (p.stock || 0) === 0).length,
  }), [products]);

  const activeFilterCount = [categoryFilter !== 'all', stockFilter !== 'all', statusFilter !== 'all', priceMin !== '', priceMax !== ''].filter(Boolean).length;
  const resetFilters = () => { setCategoryFilter('all'); setStockFilter('all'); setStatusFilter('all'); setPriceMin(''); setPriceMax(''); };

  /* ---- tier product limit meter ---- */
  const productLimit = tierInfo?.product_limit ?? tierInfo?.max_products ?? null;
  const limitReached = productLimit != null && products.length >= productLimit;
  useEffect(() => {
    if (productLimit) {
      RNAnimated.timing(meterAnim, {
        toValue: Math.min(100, Math.round((products.length / productLimit) * 100)),
        duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false,
      }).start();
    }
  }, [products.length, productLimit, meterAnim]);

  /* ---- suggested categories ---- */
  const suggestedCategoryObjects = useMemo(() => {
    if (!shopCategoryIds || shopCategoryIds.length === 0) return [];
    return shopCategoryIds.map(id => categoriesFlat.find(c => c.id === id)).filter(Boolean);
  }, [shopCategoryIds, categoriesFlat]);

  const toggleCategoryQuick = (catId) => {
    setFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId) ? prev.category_ids.filter(id => id !== catId) : [...prev.category_ids, catId],
    }));
  };

  /* ---- AI generate (ported verbatim) ---- */
  const handleAiGenerate = async () => {
    if (!formData.name?.trim() && (!formData.images || !formData.images.filter(Boolean).length)) {
      toast.error('Add a product name or upload an image first, then let AI fill the rest!');
      return;
    }
    setAiLoading(true);
    try {
      const firstImage = (formData.images || []).find(u => u && u.trim());
      const { data } = await api.shop.aiGenerateProduct({ name: formData.name, image_url: firstImage, description: formData.description });
      const updates = {};
      if (data.description) updates.description = data.description;
      if (Array.isArray(data.category_ids) && data.category_ids.length > 0) {
        updates.category_ids = [...new Set([...(formData.category_ids || []), ...data.category_ids])];
      }
      if (data.type && data.type !== 'none') updates.gender = data.type;
      setFormData(prev => ({ ...prev, ...updates }));
      setAiAccent(true);
      setTimeout(() => setAiAccent(false), 1500);
      const variantHints = (data.suggested_variants || []).join(', ');
      toast.success(`AI filled the details${variantHints ? ` · suggested variants: ${variantHints}` : ''}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI generation failed');
    } finally { setAiLoading(false); }
  };

  const handleSubmit = async () => {
    try {
      const payload = buildProductPayload(formData);

      if (editingProduct) {
        await api.shop.updateProduct(editingProduct.id, payload);
        toast.success('Product updated');
      } else {
        await api.shop.createProduct(payload);
        toast.success('Product created');
      }
      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save product');
    }
  };

  const resetForm = () => { setEditingProduct(null); setFormData({ ...EMPTY_FORM, images: [''] }); };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData(productToForm(product));
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete product', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeletingIds(prev => [...prev, id]); // card folds away (FlipOutXUp exit)
          try {
            await api.shop.deleteProduct(id);
            toast.success('Product deleted');
            setProducts(prev => prev.filter(p => p.id !== id));
          } catch (error) {
            toast.error('Failed to delete product');
            setDeletingIds(prev => prev.filter(x => x !== id));
          }
        },
      },
    ]);
  };

  const openAdd = () => {
    if (limitReached) { toast.error(`Product limit reached (${productLimit}). Upgrade to add more.`); return; }
    resetForm();
    setDialogOpen(true);
  };

  const statCards = [
    { label: 'TOTAL PRODUCTS', value: productStats.total, icon: 'cube', grad: [colors.p450, '#ffc0cb'] },
    { label: 'ACTIVE', value: productStats.active, icon: 'checkmark-circle', grad: ['#10b981', '#14b8a6'] },
    { label: 'LOW STOCK', value: productStats.lowStock, icon: 'warning', grad: ['#f59e0b', '#f97316'] },
    { label: 'OUT OF STOCK', value: productStats.outOfStock, icon: 'close', grad: ['#f43f5e', '#ef4444'] },
  ];

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} onEndReached={() => moreProducts && revealProducts()}>
      {/* Header — violet-600 -> fuchsia-600 -> rose-500 world */}
      <Rise duration={500} distance={0}>
        <LinearGradient colors={HEADER_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <Text style={st.heroTitle} testID="shop-products-title">Products</Text>
          <Text style={st.heroSub}>Manage your catalog, variants & stock</Text>
          {/* Tier product limit meter */}
          {productLimit != null && (
            <View style={st.meter}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={st.meterLabel}>PRODUCT LIMIT</Text>
                <Text style={st.meterCount}>{products.length}/{productLimit}</Text>
              </View>
              <View style={st.meterTrack}>
                <RNAnimated.View style={[st.meterFill, {
                  backgroundColor: limitReached ? '#fecdd3' : colors.white,
                  width: meterAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              {limitReached && <Text style={st.meterWarn}>Limit reached — upgrade to add more products</Text>}
            </View>
          )}
        </LinearGradient>
      </Rise>

      {/* Stats summary cards */}
      <View style={st.statsRow}>
        {statCards.map((s, i) => (
          <Rise key={s.label} delay={i * 60} duration={350} distance={12} style={st.statWrap}>
            <View style={st.stat} testID={`shop-product-stat-${i}`}>
              <View style={[st.statOrb, { backgroundColor: s.grad[0] }]} />
              <LinearGradient colors={s.grad} style={st.statTile}><Ionicons name={s.icon} size={15} color={colors.white} /></LinearGradient>
              <CountUp value={s.value} style={st.statValue} />
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          </Rise>
        ))}
      </View>

      {/* Search + Add */}
      <View style={{ flexDirection: 'row', gap: 9, marginTop: 12 }}>
        <View style={st.search}>
          <Ionicons name="search" size={15} color={colors.p400} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search products..."
            placeholderTextColor={colors.textMuted} style={st.searchInput} testID="search-products-input" />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close" size={15} color={colors.textMuted} /></TouchableOpacity>
          ) : null}
        </View>
        <PressScale onPress={openAdd}>
          <LinearGradient colors={HEADER_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[st.addBtn, limitReached && { opacity: 0.55 }]} testID="add-product-button">
            <Ionicons name="sparkles" size={15} color={colors.white} />
            <Text style={st.addBtnText}>Add Product</Text>
          </LinearGradient>
        </PressScale>
      </View>

      {/* Sorting and filters card */}
      <View style={st.filterCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="options" size={13} color={colors.textMuted} />
          <Text style={st.countText}>{filteredProducts.length} products</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => setShowFilters(v => !v)} activeOpacity={0.8}
            style={[st.filterBtn, activeFilterCount > 0 && { borderColor: colors.p400, backgroundColor: colors.p50 }]}
            testID="shop-toggle-filters-button">
            <Ionicons name="funnel" size={12} color={activeFilterCount > 0 ? colors.p800 : colors.textSecondary} />
            <Text style={[st.filterBtnText, activeFilterCount > 0 && { color: colors.p800 }]}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={st.filterCount}><Text style={st.filterCountText}>{activeFilterCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 10, gap: 8 }}>
          <ChipSelect options={STOCK_FILTERS} value={stockFilter} onChange={setStockFilter} />
          <ChipSelect options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          <ChipSelect options={SORTS} value={sortBy} onChange={setSortBy} />
        </View>

        {/* Filters panel — slides + fades */}
        <RNAnimated.View style={{
          opacity: filterAnim,
          maxHeight: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }),
          overflow: 'hidden',
        }} testID="shop-products-filters-panel">
          <View style={st.filterPanel}>
            <Text style={st.panelLabel}><Ionicons name="funnel" size={10} color={colors.textSecondary} /> CATEGORY</Text>
            <ChipSelect options={[{ v: 'all', l: 'All Categories' }, ...categoriesFlat.map(c => ({ v: c.id, l: c.name }))]}
              value={categoryFilter} onChange={setCategoryFilter} testID="shop-products-category-filter" />
            <Text style={[st.panelLabel, { marginTop: 10 }]}><Ionicons name="logo-usd" size={10} color={colors.textSecondary} /> CUSTOMER PRICE RANGE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={priceMin} onChangeText={setPriceMin} keyboardType="decimal-pad" placeholder="Min"
                placeholderTextColor={colors.textMuted} style={[st.priceInput]} testID="shop-products-price-min" />
              <Text style={{ color: colors.textMuted }}>–</Text>
              <TextInput value={priceMax} onChangeText={setPriceMax} keyboardType="decimal-pad" placeholder="Max"
                placeholderTextColor={colors.textMuted} style={[st.priceInput]} testID="shop-products-price-max" />
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={resetFilters} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, padding: 6 }} testID="shop-clear-filters-button">
                  <Ionicons name="close" size={13} color={colors.sale} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.sale }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </RNAnimated.View>
      </View>

      {/* Commission Info Banner — violet-50 -> indigo-50 */}
      <LinearGradient colors={[colors.p50, colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.commBanner} testID="commission-info-banner">
        <View style={st.commIcon}><Ionicons name="pricetag" size={14} color={colors.p500} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.commTitle}>Commission: {commissionRate}%</Text>
          <Text style={st.commBody}>
            {commissionType === 'on_shop' && 'Deducted from your revenue (customer sees listed price)'}
            {commissionType === 'on_customer' && 'Added to customer price (you receive full listed price)'}
            {commissionType === 'half_half' && 'Split: half from your revenue, half added to customer price'}
          </Text>
        </View>
      </LinearGradient>

      {/* Products list (grid re-flows with LinearTransition) */}
      <View style={{ marginTop: 12, gap: 10 }}>
        {visibleProducts.map((product) => {
          const originalPrice = product.original_price || product.price;
          const originalDiscount = product.original_discount_price || product.discount_price;
          const customerPrice = product.customer_price || product.price;
          const customerDiscount = product.customer_discount_price || product.discount_price;
          const shopRevPrice = product.shop_revenue_price || originalPrice;
          const shopRevDiscount = product.shop_revenue_discount_price || originalDiscount;
          const showRevHint = shopRevPrice !== originalPrice;
          const hasGift = !!productGifts[product.id];
          return (
            <Animated.View key={product.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={FlipOutXUp.duration(320)}>
              <View style={st.prodCard}>
                <View style={{ flexDirection: 'row', gap: 11 }}>
                  {/* image + photo count */}
                  <View>
                    {product.images?.[0] ? (
                      <Image source={{ uri: img(product.images[0]) }} style={st.prodImg} />
                    ) : (
                      <View style={[st.prodImg, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="cube" size={19} color={colors.textMuted} />
                      </View>
                    )}
                    {product.images && product.images.length > 1 && (
                      <View style={st.photoCount} testID={`photo-count-${product.id}`}>
                        <Text style={st.photoCountText}>+{product.images.length - 1}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={st.prodName} numberOfLines={1}>{product.name}</Text>
                      {product.is_promoted && (
                        <View style={st.promotedBadge}>
                          <Ionicons name="megaphone" size={8} color="#b45309" />
                          <Text style={st.promotedText}>Promoted</Text>
                        </View>
                      )}
                    </View>
                    {/* variant chips */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {product.has_color_variants && product.colors?.length > 0 && (
                        <View style={[st.varChip, { backgroundColor: colors.p100 }]}><Text style={[st.varChipText, { color: colors.p800 }]}>{product.colors.length} Colors</Text></View>
                      )}
                      {product.has_size_variants && product.sizes?.length > 0 && (
                        <View style={[st.varChip, { backgroundColor: '#dbeafe' }]}><Text style={[st.varChipText, { color: '#1d4ed8' }]}>{product.sizes.length} Sizes</Text></View>
                      )}
                      {product.has_shape_variants && product.shapes?.length > 0 && (
                        <View style={[st.varChip, { backgroundColor: '#d1fae5' }]}><Text style={[st.varChipText, { color: '#047857' }]}>{product.shapes.length} Shapes</Text></View>
                      )}
                      {product.has_type_variants && product.types?.length > 0 && (
                        <View style={[st.varChip, { backgroundColor: '#fef3c7' }]}><Text style={[st.varChipText, { color: '#b45309' }]}>{product.types.length} Types</Text></View>
                      )}
                      {!product.has_color_variants && !product.has_size_variants && !product.has_shape_variants && !product.has_type_variants && (
                        <Text style={{ fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted }}>No variants</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="eye" size={11} color={colors.textMuted} />
                        <Text style={st.metaText}>{product.view_count || 0}</Text>
                      </View>
                      <Text style={st.metaText}>Stock: {product.stock}</Text>
                      <ShopPill label={product.is_active ? 'Active' : 'Inactive'} variant={product.is_active ? 'emerald' : 'red'} />
                    </View>
                  </View>
                </View>

                {/* prices */}
                <View style={{ flexDirection: 'row', gap: 9, marginTop: 10 }}>
                  <View style={st.priceCol} testID={`your-price-${product.id}`}>
                    <Text style={st.priceK}>YOUR PRICE</Text>
                    <Text style={st.priceV}>${originalPrice.toFixed(2)}</Text>
                    {originalDiscount ? <Text style={st.priceSale}>Sale: ${originalDiscount.toFixed(2)}</Text> : null}
                    <Text style={st.priceHint}>As you entered</Text>
                    {showRevHint && (
                      <Text style={st.revHint}>You receive: ${shopRevPrice.toFixed(2)}{shopRevDiscount ? ` / $${shopRevDiscount.toFixed(2)}` : ''}</Text>
                    )}
                  </View>
                  <View style={[st.priceCol, { backgroundColor: colors.p50 }]}>
                    <Text style={[st.priceK, { color: colors.p500 }]}>CUSTOMER PRICE</Text>
                    <Text style={[st.priceV, { color: colors.p800 }]}>${customerPrice.toFixed(2)}</Text>
                    {customerDiscount ? <Text style={[st.priceSale, { color: colors.p800, backgroundColor: colors.p100 }]}>Sale: ${customerDiscount.toFixed(2)}</Text> : null}
                    <Text style={st.priceHint}>What they see</Text>
                  </View>
                </View>

                {/* actions */}
                <View style={st.actionsRow}>
                  <TouchableOpacity onPress={() => { setBoostTarget(product); setBoostDialogOpen(true); }} style={st.actionBtn} testID={`boost-btn-${product.id}`}>
                    <Ionicons name="megaphone" size={15} color="#f59e0b" />
                    <Text style={[st.actionText, { color: '#d97706' }]}>Boost</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setGiftProductId(product.id); setGiftProductName(product.name); setGiftDialogOpen(true); }}
                    style={[st.actionBtn, hasGift && { backgroundColor: '#fdf2f8' }]} testID={`gift-btn-${product.id}`}>
                    <Ionicons name="gift" size={15} color={hasGift ? '#db2777' : '#f9a8d4'} />
                    <Text style={[st.actionText, { color: '#db2777' }]}>{hasGift ? 'Edit Gift' : 'Gift'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleEdit(product)} style={st.actionBtn}>
                    <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
                    <Text style={st.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(product.id)} style={st.actionBtn}>
                    <Ionicons name="trash" size={15} color={colors.saleAlt} />
                    <Text style={[st.actionText, { color: colors.saleAlt }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        })}
        {revealingProducts && <SkeletonGrid count={2} columns={1} style={{ marginTop: 0, paddingHorizontal: 0 }} />}
        {filteredProducts.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="cube-outline" size={40} color={colors.border} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 10 }}>No products yet. Add your first product!</Text>
          </View>
        )}
      </View>
    </ShopScreenWrap>

    {/* Add/Edit product — full-screen native form */}
    <ProductFormSheet
      open={dialogOpen}
      editingProduct={editingProduct}
      formData={formData}
      setFormData={setFormData}
      categories={categories}
      variantToggles={variantToggles}
      commissionRate={commissionRate}
      commissionType={commissionType}
      calculateCustomerPrice={calculateCustomerPrice}
      calculateShopRevenue={calculateShopRevenue}
      getCommissionTypeLabel={getCommissionTypeLabel}
      onSubmit={handleSubmit}
      onCancel={() => { setDialogOpen(false); resetForm(); }}
      enableAI
      onAiGenerate={handleAiGenerate}
      aiLoading={aiLoading}
      aiAccent={aiAccent}
      suggestedCategoryObjects={suggestedCategoryObjects}
      toggleCategoryQuick={toggleCategoryQuick}
    />

    <BoostSheet open={boostDialogOpen} onClose={() => setBoostDialogOpen(false)} product={boostTarget} onSuccess={fetchProducts} />
    <GiftSheet open={giftDialogOpen} onOpenChange={setGiftDialogOpen} productId={giftProductId} productName={giftProductName}
      onGiftSaved={() => { fetchProducts(); fetchTierAndGifts(); }} />
    </>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 18, ...shadow.emphasis },
  heroTitle: { color: colors.white, fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  meter: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: 11 },
  meterLabel: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
  meterCount: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 11 },
  meterTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  meterWarn: { color: '#fecdd3', fontFamily: fonts.semibold, fontSize: 10, marginTop: 5 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 13, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  statOrb: { position: 'absolute', top: -14, right: -14, width: 56, height: 56, borderRadius: 28, opacity: 0.1 },
  statTile: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...shadow.card },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.semibold, fontSize: 9.5, color: colors.textMuted, letterSpacing: 0.8, marginTop: 1 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, paddingHorizontal: 14, height: 44, ...shadow.violetGlow },
  addBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12.5 },
  filterCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 10, ...shadow.card },
  countText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  filterBtnText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  filterCount: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.p500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8.5 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surface },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  filterPanel: { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 11, paddingTop: 11 },
  panelLabel: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 6 },
  priceInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  commBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.p200, borderRadius: radius.md, padding: 11, marginTop: 10 },
  commIcon: { padding: 6, borderRadius: 9, backgroundColor: colors.p100 },
  commTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.p925 },
  commBody: { fontFamily: fonts.body, fontSize: 10.5, color: colors.p800, marginTop: 1, lineHeight: 14 },
  prodCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 13, ...shadow.card },
  prodImg: { width: 58, height: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  photoCount: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.p500, borderRadius: radius.pill, minWidth: 18, paddingHorizontal: 4, paddingVertical: 1, alignItems: 'center', ...shadow.card },
  photoCountText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8.5 },
  prodName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, maxWidth: 180 },
  promotedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  promotedText: { fontFamily: fonts.semibold, fontSize: 9, color: '#b45309' },
  varChip: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  varChipText: { fontFamily: fonts.semibold, fontSize: 9 },
  metaText: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary },
  priceCol: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10 },
  priceK: { fontFamily: fonts.bold, fontSize: 8.5, color: colors.textMuted, letterSpacing: 0.8 },
  priceV: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink, marginTop: 2 },
  priceSale: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textSecondary, backgroundColor: colors.borderLight, alignSelf: 'flex-start', borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  priceHint: { fontFamily: fonts.body, fontSize: 8.5, color: colors.textMuted, marginTop: 3 },
  revHint: { fontFamily: fonts.semibold, fontSize: 9.5, color: '#059669', marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 7, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.sm, paddingVertical: 8, backgroundColor: colors.surfaceMuted },
  actionText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
});
