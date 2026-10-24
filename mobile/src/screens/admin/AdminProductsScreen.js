import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Image, Switch, Animated as RNAnimated, Easing, ScrollView, useWindowDimensions } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { LinearTransition, FadeIn, FlipOutXUp } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, CountUp, ShopPill, toast } from '../../components/shop/ShopKit';
import { useReveal } from '../../lib/useReveal';
import { SkeletonGrid } from '../../components/ui';

const HEADER_GRAD = [colors.p500, '#f06a92', '#f43f5e'];
const GRID_KEY = 'admin_products_grid';
const thumb = (p) => p.images?.[0] || p.image || p.colors?.[0]?.image_url || null;

const STOCK_FILTERS = [{ v: 'all', l: 'All Stock' }, { v: 'in_stock', l: 'In Stock' }, { v: 'low_stock', l: 'Low Stock' }, { v: 'out_of_stock', l: 'Out of Stock' }];
const STATUS_FILTERS = [{ v: 'all', l: 'All' }, { v: 'active', l: 'Active' }, { v: 'inactive', l: 'Inactive' }];
const SORTS = [
  { v: 'newest', l: 'Newest First' }, { v: 'oldest', l: 'Oldest First' },
  { v: 'name_asc', l: 'Name A-Z' }, { v: 'name_desc', l: 'Name Z-A' },
  { v: 'price_asc', l: 'Price Low-High' }, { v: 'price_desc', l: 'Price High-Low' },
  { v: 'stock_asc', l: 'Stock Low-High' }, { v: 'stock_desc', l: 'Stock High-Low' },
];
const GRID_ICONS = [['reorder-four', 1], ['grid', 2], ['apps', 3]];

function ChipSelect({ options, value, onChange, accent = colors.p500, testID }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID={testID}>
      {options.map((o) => (
        <TouchableOpacity key={o.v} onPress={() => onChange(o.v)} style={[st.chip, value === o.v && { backgroundColor: accent, borderColor: accent }]}>
          <Text style={[st.chipText, value === o.v && { color: colors.white }]}>{o.l}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function AdminProductsScreen() {
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState([]);
  const [categoriesFlat, setCategoriesFlat] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [stockFilter, setStockFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [gridCols, setGridCols] = useState(1);
  const [deletingIds, setDeletingIds] = useState([]);
  const filterAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => { fetchProducts(); fetchCategories(); AsyncStorage.getItem(GRID_KEY).then((v) => v && setGridCols(parseInt(v, 10) || 1)); }, []);
  useEffect(() => { RNAnimated.timing(filterAnim, { toValue: showFilters ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [showFilters, filterAnim]);

  const setGrid = (n) => { setGridCols(n); AsyncStorage.setItem(GRID_KEY, String(n)); };

  const fetchProducts = async () => {
    try { const { data } = await api.admin.getAllProducts(); setProducts(Array.isArray(data) ? data : data?.products || []); } catch {}
  };
  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getTree();
      const flat = []; const walk = (n) => (n || []).forEach((x) => { flat.push({ id: x.id, name: x.name }); if (x.children) walk(x.children); }); walk(data);
      setCategoriesFlat(flat);
    } catch {}
  };
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchProducts(); setRefreshing(false); }, []);

  const filteredProducts = useMemo(() => {
    let f = [...products];
    if (searchQuery) { const q = searchQuery.toLowerCase(); f = f.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.shop_name || '').toLowerCase().includes(q)); }
    if (categoryFilter !== 'all') f = f.filter((p) => (p.category_ids || []).includes(categoryFilter) || p.category_id === categoryFilter);
    if (priceMin !== '' && !isNaN(parseFloat(priceMin))) f = f.filter((p) => (p.customer_price || p.price || 0) >= parseFloat(priceMin));
    if (priceMax !== '' && !isNaN(parseFloat(priceMax))) f = f.filter((p) => (p.customer_price || p.price || 0) <= parseFloat(priceMax));
    if (stockFilter === 'in_stock') f = f.filter((p) => p.stock > 0);
    else if (stockFilter === 'out_of_stock') f = f.filter((p) => (p.stock || 0) === 0);
    else if (stockFilter === 'low_stock') f = f.filter((p) => p.stock > 0 && p.stock <= 10);
    if (statusFilter === 'active') f = f.filter((p) => p.is_active !== false);
    else if (statusFilter === 'inactive') f = f.filter((p) => p.is_active === false);
    switch (sortBy) {
      case 'name_asc': f.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'name_desc': f.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
      case 'price_asc': f.sort((a, b) => (a.discount_price || a.price) - (b.discount_price || b.price)); break;
      case 'price_desc': f.sort((a, b) => (b.discount_price || b.price) - (a.discount_price || a.price)); break;
      case 'stock_asc': f.sort((a, b) => a.stock - b.stock); break;
      case 'stock_desc': f.sort((a, b) => b.stock - a.stock); break;
      case 'oldest': f.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); break;
      default: f.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    }
    return f;
  }, [products, searchQuery, sortBy, stockFilter, statusFilter, categoryFilter, priceMin, priceMax]);

  const productStats = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.is_active !== false).length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= 10).length,
    outOfStock: products.filter((p) => (p.stock || 0) === 0).length,
  }), [products]);

  const activeFilterCount = [categoryFilter !== 'all', stockFilter !== 'all', statusFilter !== 'all', priceMin !== '', priceMax !== ''].filter(Boolean).length;
  const resetFilters = () => { setCategoryFilter('all'); setStockFilter('all'); setStatusFilter('all'); setPriceMin(''); setPriceMax(''); };

  const toggleActive = async (p) => {
    const next = !(p.is_active !== false);
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)));
    try { await api.products.update(p.id, { is_active: next }); } catch { toast.error('Failed to update'); fetchProducts(); }
  };
  const handleDelete = (p) => Alert.alert('Delete product', `Remove "${p.name}"?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { setDeletingIds((d) => [...d, p.id]); try { await api.products.delete(p.id); toast.success('Product deleted'); setProducts((prev) => prev.filter((x) => x.id !== p.id)); } catch { toast.error('Failed to delete'); setDeletingIds((d) => d.filter((x) => x !== p.id)); } } },
  ]);

  const statCards = [
    { label: 'TOTAL PRODUCTS', value: productStats.total, icon: 'cube', grad: [colors.p450, '#ffc0cb'] },
    { label: 'ACTIVE', value: productStats.active, icon: 'checkmark-circle', grad: ['#10b981', '#14b8a6'] },
    { label: 'LOW STOCK', value: productStats.lowStock, icon: 'warning', grad: ['#f59e0b', '#f97316'] },
    { label: 'OUT OF STOCK', value: productStats.outOfStock, icon: 'close', grad: ['#f43f5e', '#ef4444'] },
  ];

  const gap = 10;
  const cardW = gridCols === 1 ? '100%' : (width - 28 - gap * (gridCols - 1)) / gridCols;
  const list = useMemo(() => filteredProducts.filter((p) => !deletingIds.includes(p.id)), [filteredProducts, deletingIds]);
  const { visible: visibleProducts, hasMore: moreProducts, revealing: revealingProducts, revealMore: revealProducts } = useReveal(list, 9);

  return (
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh} onEndReached={() => moreProducts && revealProducts()}>
      <Rise duration={500} distance={0}>
        <LinearGradient colors={HEADER_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <Text style={st.heroTitle} testID="admin-products-title">Products</Text>
          <Text style={st.heroSub}>All catalog products across shops</Text>
        </LinearGradient>
      </Rise>

      {/* Stats */}
      <View style={st.statsRow}>
        {statCards.map((s, i) => (
          <Rise key={s.label} delay={i * 60} duration={350} distance={12} style={st.statWrap}>
            <View style={st.stat} testID={`admin-product-stat-${i}`}>
              <View style={[st.statOrb, { backgroundColor: s.grad[0] }]} />
              <LinearGradient colors={s.grad} style={st.statTile}><Ionicons name={s.icon} size={15} color={colors.white} /></LinearGradient>
              <CountUp value={s.value} style={st.statValue} />
              <Text style={st.statLabel}>{s.label}</Text>
            </View>
          </Rise>
        ))}
      </View>

      {/* Search */}
      <View style={{ marginTop: 12 }}>
        <View style={st.search}>
          <Ionicons name="search" size={15} color={colors.p400} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search products, shops..." placeholderTextColor={colors.textMuted} style={st.searchInput} testID="admin-products-search" />
          {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close" size={15} color={colors.textMuted} /></TouchableOpacity> : null}
        </View>
      </View>

      {/* Filters + grid toggle */}
      <View style={st.filterCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="options" size={13} color={colors.textMuted} />
          <Text style={st.countText}>{list.length} products</Text>
          <View style={{ flex: 1 }} />
          <View style={st.gridToggle}>
            {GRID_ICONS.map(([ic, n]) => (
              <TouchableOpacity key={n} onPress={() => setGrid(n)} style={[st.gridBtn, gridCols === n && st.gridBtnOn]}><Ionicons name={ic} size={14} color={gridCols === n ? colors.white : colors.textMuted} /></TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setShowFilters((v) => !v)} activeOpacity={0.8} style={[st.filterBtn, activeFilterCount > 0 && { borderColor: colors.p400, backgroundColor: colors.p50 }]} testID="admin-products-toggle-filters">
            <Ionicons name="funnel" size={12} color={activeFilterCount > 0 ? colors.p800 : colors.textSecondary} />
            <Text style={[st.filterBtnText, activeFilterCount > 0 && { color: colors.p800 }]}>Filters</Text>
            {activeFilterCount > 0 && <View style={st.filterCount}><Text style={st.filterCountText}>{activeFilterCount}</Text></View>}
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 10, gap: 8 }}>
          <ChipSelect options={STOCK_FILTERS} value={stockFilter} onChange={setStockFilter} />
          <ChipSelect options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          <ChipSelect options={SORTS} value={sortBy} onChange={setSortBy} />
        </View>

        <RNAnimated.View style={{ opacity: filterAnim, maxHeight: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] }), overflow: 'hidden' }} testID="admin-products-filters-panel">
          <View style={st.filterPanel}>
            <Text style={st.panelLabel}>CATEGORY</Text>
            <ChipSelect options={[{ v: 'all', l: 'All Categories' }, ...categoriesFlat.map((c) => ({ v: c.id, l: c.name }))]} value={categoryFilter} onChange={setCategoryFilter} testID="admin-products-category-filter" />
            <Text style={[st.panelLabel, { marginTop: 10 }]}>CUSTOMER PRICE RANGE</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput value={priceMin} onChangeText={setPriceMin} keyboardType="decimal-pad" placeholder="Min" placeholderTextColor={colors.textMuted} style={st.priceInput} testID="admin-products-price-min" />
              <Text style={{ color: colors.textMuted }}>–</Text>
              <TextInput value={priceMax} onChangeText={setPriceMax} keyboardType="decimal-pad" placeholder="Max" placeholderTextColor={colors.textMuted} style={st.priceInput} testID="admin-products-price-max" />
              {activeFilterCount > 0 && <TouchableOpacity onPress={resetFilters} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, padding: 6 }} testID="admin-products-clear-filters"><Ionicons name="close" size={13} color={colors.sale} /><Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.sale }}>Clear</Text></TouchableOpacity>}
            </View>
          </View>
        </RNAnimated.View>
      </View>

      {/* Products grid (re-flows with LinearTransition) */}
      <View style={[st.grid, gridCols === 1 && { flexDirection: 'column' }]}>
        {visibleProducts.map((product) => (
          <Animated.View key={product.id} layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={FlipOutXUp.duration(320)} style={{ width: cardW }}>
            {gridCols === 1
              ? <ProductRow product={product} onToggle={() => toggleActive(product)} onDelete={() => handleDelete(product)} />
              : <ProductGridCard product={product} compact={gridCols === 3} onToggle={() => toggleActive(product)} onDelete={() => handleDelete(product)} />}
          </Animated.View>
        ))}
        {revealingProducts && <SkeletonGrid count={gridCols === 1 ? 2 : gridCols} columns={gridCols} style={{ width: '100%', marginTop: 0, paddingHorizontal: 0 }} />}
        {list.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40, width: '100%' }}>
            <Ionicons name="cube-outline" size={40} color={colors.border} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 10 }}>No products found</Text>
          </View>
        )}
      </View>
    </ShopScreenWrap>
  );
}

/* ---------- full row (1-col) — mirrors the shop product card ---------- */
function ProductRow({ product, onToggle, onDelete }) {
  const price = product.price || 0;
  const discount = product.discount_price;
  const customerPrice = product.customer_price || product.price || 0;
  const customerDiscount = product.customer_discount_price || product.discount_price;
  const active = product.is_active !== false;
  const variants = [
    product.has_color_variants && product.colors?.length > 0 ? { n: product.colors.length, l: 'Colors', bg: colors.p100, fg: colors.p800 } : null,
    product.has_size_variants && product.sizes?.length > 0 ? { n: product.sizes.length, l: 'Sizes', bg: '#dbeafe', fg: '#1d4ed8' } : null,
    product.has_shape_variants && product.shapes?.length > 0 ? { n: product.shapes.length, l: 'Shapes', bg: '#d1fae5', fg: '#047857' } : null,
    product.has_type_variants && product.types?.length > 0 ? { n: product.types.length, l: 'Types', bg: '#fef3c7', fg: '#b45309' } : null,
  ].filter(Boolean);
  return (
    <View style={st.prodCard}>
      <View style={{ flexDirection: 'row', gap: 11 }}>
        <View>
          {thumb(product) ? <Image source={{ uri: img(thumb(product)) }} style={st.prodImg} /> : <View style={[st.prodImg, st.fallback]}><Ionicons name="cube" size={19} color={colors.textMuted} /></View>}
          {product.images && product.images.length > 1 && <View style={st.photoCount}><Text style={st.photoCountText}>+{product.images.length - 1}</Text></View>}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={st.prodName} numberOfLines={1}>{product.name}</Text>
            {(product.is_promoted || product.is_sponsored) && <View style={st.promotedBadge}><Ionicons name="megaphone" size={8} color="#b45309" /><Text style={st.promotedText}>Boosted</Text></View>}
          </View>
          <Text style={st.shopName} numberOfLines={1}>{product.shop_name || 'Shop'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {variants.length > 0 ? variants.map((v) => <View key={v.l} style={[st.varChip, { backgroundColor: v.bg }]}><Text style={[st.varChipText, { color: v.fg }]}>{v.n} {v.l}</Text></View>)
              : <Text style={{ fontFamily: fonts.body, fontSize: 9.5, color: colors.textMuted }}>No variants</Text>}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="eye" size={11} color={colors.textMuted} /><Text style={st.metaText}>{product.view_count || 0}</Text></View>
            <Text style={st.metaText}>Stock: {product.stock}</Text>
            <ShopPill label={active ? 'Active' : 'Inactive'} variant={active ? 'emerald' : 'red'} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 9, marginTop: 10 }}>
        <View style={st.priceCol}>
          <Text style={st.priceK}>SHOP PRICE</Text>
          <Text style={st.priceV}>${price.toFixed(2)}</Text>
          {discount ? <Text style={st.priceSale}>Sale: ${discount.toFixed(2)}</Text> : null}
        </View>
        <View style={[st.priceCol, { backgroundColor: colors.p50 }]}>
          <Text style={[st.priceK, { color: colors.p500 }]}>CUSTOMER PRICE</Text>
          <Text style={[st.priceV, { color: colors.p800 }]}>${customerPrice.toFixed(2)}</Text>
          {customerDiscount ? <Text style={[st.priceSale, { color: colors.p800, backgroundColor: colors.p100 }]}>Sale: ${customerDiscount.toFixed(2)}</Text> : null}
        </View>
      </View>
      <View style={st.actionsRow}>
        <TouchableOpacity onPress={onToggle} style={st.actionBtn}>
          <Ionicons name={active ? 'pause-circle-outline' : 'play-circle-outline'} size={15} color={active ? '#d97706' : '#059669'} />
          <Text style={[st.actionText, { color: active ? '#d97706' : '#059669' }]}>{active ? 'Deactivate' : 'Activate'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={st.actionBtn}>
          <Ionicons name="trash" size={15} color={colors.saleAlt} />
          <Text style={[st.actionText, { color: colors.saleAlt }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- compact grid card (2/3-col) ---------- */
function ProductGridCard({ product, compact, onToggle, onDelete }) {
  const active = product.is_active !== false;
  return (
    <View style={st.gcard}>
      <View style={st.gimgWrap}>{thumb(product) ? <Image source={{ uri: img(thumb(product)) }} style={st.gimg} /> : <View style={[st.gimg, st.fallback]}><Ionicons name="cube" size={20} color={colors.textMuted} /></View>}
        {(product.is_promoted || product.is_sponsored) && <View style={st.gBoost}><Ionicons name="star" size={8} color="#b45309" /></View>}
      </View>
      <Text style={st.gname} numberOfLines={compact ? 1 : 2}>{product.name}</Text>
      {!compact && <Text style={st.gshop} numberOfLines={1}>{product.shop_name || 'Shop'}</Text>}
      <View style={st.growBot}>
        <Text style={st.gprice}>${Number(product.discount_price || product.price || 0).toFixed(2)}</Text>
        {compact ? <View style={[st.statusDot, { backgroundColor: active ? '#10b981' : '#94a3b8' }]} />
          : <Switch value={active} onValueChange={onToggle} trackColor={{ true: colors.violet, false: colors.border }} thumbColor={colors.white} style={{ transform: [{ scale: 0.8 }] }} />}
      </View>
      {!compact && (
        <TouchableOpacity onPress={onDelete} style={st.gDelete}><Ionicons name="trash-outline" size={14} color={colors.sale} /><Text style={st.gDeleteText}>Delete</Text></TouchableOpacity>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 18, ...shadow.emphasis },
  heroTitle: { color: colors.white, fontFamily: fonts.heading, fontSize: 26, letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 13, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  statOrb: { position: 'absolute', top: -14, right: -14, width: 56, height: 56, borderRadius: 28, opacity: 0.1 },
  statTile: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8, ...shadow.card },
  statValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.semibold, fontSize: 9.5, color: colors.textMuted, letterSpacing: 0.8, marginTop: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  filterCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 10, ...shadow.card },
  countText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted },
  gridToggle: { flexDirection: 'row', gap: 3, backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, padding: 3 },
  gridBtn: { width: 28, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  gridBtnOn: { backgroundColor: colors.violet },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  filterBtnText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textSecondary },
  filterCount: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.p500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8.5 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surface },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  filterPanel: { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: 11, paddingTop: 11 },
  panelLabel: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 6 },
  priceInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  prodCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 13, ...shadow.card },
  prodImg: { width: 58, height: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  fallback: { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  photoCount: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.p500, borderRadius: radius.pill, minWidth: 18, paddingHorizontal: 4, paddingVertical: 1, alignItems: 'center', ...shadow.card },
  photoCountText: { color: colors.white, fontFamily: fonts.bold, fontSize: 8.5 },
  prodName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, maxWidth: 170 },
  shopName: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 1 },
  promotedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  promotedText: { fontFamily: fonts.semibold, fontSize: 9, color: '#b45309' },
  varChip: { borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  varChipText: { fontFamily: fonts.semibold, fontSize: 9 },
  metaText: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary },
  priceCol: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10 },
  priceK: { fontFamily: fonts.bold, fontSize: 8.5, color: colors.textMuted, letterSpacing: 0.8 },
  priceV: { fontFamily: fonts.extrabold, fontSize: 15.5, color: colors.ink, marginTop: 2 },
  priceSale: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textSecondary, backgroundColor: colors.borderLight, alignSelf: 'flex-start', borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  actionsRow: { flexDirection: 'row', gap: 7, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.sm, paddingVertical: 8, backgroundColor: colors.surfaceMuted },
  actionText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary },
  gcard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 8, ...shadow.card },
  gimgWrap: { width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginBottom: 6 },
  gimg: { width: '100%', height: '100%' },
  gBoost: { position: 'absolute', top: 5, left: 5, backgroundColor: '#fef3c7', borderRadius: radius.pill, padding: 3 },
  gname: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, minHeight: 16 },
  gshop: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  growBot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  gprice: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.violet },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  gDelete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: '#fff1f2' },
  gDeleteText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.sale },
});
