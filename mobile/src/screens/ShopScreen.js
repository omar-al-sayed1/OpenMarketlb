import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Image, FlatList, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { api } from '../lib/api';
import { img } from '../lib/media';
import ProductCard from '../components/ProductCard';
import { hiddenRefreshControl, RefreshIndicator } from '../components/CustomRefresh';
import BottomSheet from '../components/BottomSheet';
import { SkeletonBlock, ProductCardSkeleton, Empty, TAB_SPACE } from '../components/ui';
import { SponsoredAddOns, RecommendedHeader } from '../components/EndOfPagePromos';
import { listPerfProps } from '../lib/useReveal';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

const BLOCK_ROWS = 4; // inject a sponsored rail after every 4 grid rows
const CAT_GRAD = [[colors.p450, colors.s600], ['#10b981', '#14b8a6'], ['#f59e0b', '#f97316'], ['#ec4899', '#f43f5e'], ['#3b82f6', '#06b6d4'], ['#ffc0cb', colors.p400]];
const SORTS = [
  { key: 'recommended', label: 'Recommended', sort_by: undefined, icon: 'sparkles' },
  { key: 'newest', label: 'Newest', sort_by: 'newest', icon: 'time' },
  { key: 'price_low', label: 'Price: Low to High', sort_by: 'price_asc', icon: 'arrow-up' },
  { key: 'price_high', label: 'Price: High to Low', sort_by: 'price_desc', icon: 'arrow-down' },
  { key: 'popular', label: 'Most Popular', sort_by: 'popular', icon: 'flame' },
];
const TYPES = [{ key: 'men', label: "Men's" }, { key: 'women', label: "Women's" }, { key: 'kids', label: 'Kids' }];

export default function ShopScreen({ navigation, route }) {
  const initialCat = route.params?.categoryId ?? null;
  const initialCatName = route.params?.categoryName ?? null;
  const initialType = route.params?.type ?? null;

  const [products, setProducts] = useState([]);
  const [sponsored, setSponsored] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // End-of-page "Recommended picks" grid — shown once the filtered results run out (only when a
  // filter is active). Infinite-scroll + skeleton, driven by the same list's onEndReached.
  const [recs, setRecs] = useState([]);
  const [recPage, setRecPage] = useState(1);
  const [recMore, setRecMore] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const recStarted = useRef(false);

  const [cats, setCats] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [selCats, setSelCats] = useState(initialCat ? [initialCat] : []);
  const [selType, setSelType] = useState(initialType);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [discMin, setDiscMin] = useState('');
  const [discMax, setDiscMax] = useState('');
  const [selColors, setSelColors] = useState([]);
  const [selSizes, setSelSizes] = useState([]);
  const [selShapes, setSelShapes] = useState([]);
  const [variantOpts, setVariantOpts] = useState({ colors: [], sizes: [], shapes: [] });
  const [catCounts, setCatCounts] = useState({}); // { categoryId: productCount } for the filter tree
  const { width: W } = useWindowDimensions();
  const seedRef = useRef(false);                  // swipe-commit seeds products → skip the full-screen skeleton
  const listRef = useRef(null);                   // main product list — kept mounted across category swipes (no remount)
  const [adj, setAdj] = useState({ prev: [], next: [] }); // pre-fetched neighbour products for the live peek

  const params = useCallback((p) => {
    const s = SORTS.find((x) => x.key === sort);
    return {
      page: p, limit: 12,
      ...(selCats.length ? { category_ids: selCats.join(',') } : {}),
      ...(selType ? { type: selType } : {}),
      ...(priceMin ? { min_price: priceMin } : {}),
      ...(priceMax ? { max_price: priceMax } : {}),
      ...(discMin ? { min_discount: discMin } : {}),
      ...(discMax ? { max_discount: discMax } : {}),
      ...(selColors.length ? { colors: selColors.join(',') } : {}),
      ...(selSizes.length ? { sizes: selSizes.join(',') } : {}),
      ...(selShapes.length ? { shapes: selShapes.join(',') } : {}),
      ...(s?.sort_by ? { sort_by: s.sort_by } : {}),
    };
  }, [sort, selCats, selType, priceMin, priceMax, discMin, discMax, selColors, selSizes, selShapes]);

  const load = useCallback(async (p) => {
    if (p === 1) { if (!seedRef.current) setLoading(true); } else setLoadingMore(true);
    seedRef.current = false; // consumed
    try {
      const { data } = await api.products.getAll(params(p));
      const items = Array.isArray(data) ? data : data?.products || [];
      setProducts((prev) => (p === 1 ? items : [...prev, ...items]));
      if (items.length < 12 || data?.has_more === false) setMore(false); else setMore(true);
      setPage(p + 1);
    } catch (_) { setMore(false); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [params]);

  useEffect(() => {
    api.categories.getTree(true).then(({ data }) => setCats(Array.isArray(data) ? data : data?.categories || [])).catch(() => {});
    api.promotions.getActive({ limit: 20 }).then(({ data }) => setSponsored(data?.products || [])).catch(() => {});
    // Product counts per category (whole catalog) → totals on the filter tree, like the web.
    api.products.getAll({ is_active: true, limit: 1000 }).then(({ data }) => {
      const list = Array.isArray(data) ? data : data?.products || [];
      const counts = {};
      list.forEach((p) => {
        new Set([p.category_id, ...(p.category_ids || [])].filter(Boolean)).forEach((cid) => { counts[cid] = (counts[cid] || 0) + 1; });
      });
      setCatCounts(counts);
    }).catch(() => {});
  }, []);

  const activeFilters = selCats.length + (selType ? 1 : 0) + (priceMin || priceMax ? 1 : 0) + (discMin || discMax ? 1 : 0) + selColors.length + selSizes.length + selShapes.length;

  // Recommended picks loader (popular products), paginated.
  const loadRecs = useCallback(async (p) => {
    setRecLoading(true);
    try {
      const { data } = await api.products.getAll({ is_active: true, page: p, limit: 12, sort_by: 'popular' });
      const items = Array.isArray(data) ? data : data?.products || [];
      setRecs((prev) => (p === 1 ? items : [...prev, ...items]));
      if (items.length < 12 || data?.has_more === false) setRecMore(false); else setRecMore(true);
      setRecPage(p + 1);
    } catch (_) { setRecMore(false); }
    finally { setRecLoading(false); }
  }, []);

  // Reload when filters/sort change (also reset the recommended tail).
  useEffect(() => {
    setPage(1); setMore(true); load(1);
    setRecs([]); setRecPage(1); setRecMore(true); recStarted.current = false;
  }, [sort, selCats, selType, priceMin, priceMax, discMin, discMax, selColors, selSizes, selShapes]); // eslint-disable-line

  // Once the filtered results are exhausted AND a filter is active, kick off the first page of
  // recommended picks. Further pages load via the list's onEndReached.
  useEffect(() => {
    if (activeFilters > 0 && !more && !loading && !recStarted.current) {
      recStarted.current = true;
      loadRecs(1);
    }
  }, [activeFilters, more, loading, loadRecs]); // eslint-disable-line

  // Pull-to-refresh: reload page 1 without the skeleton (seedRef skips the loading state).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    seedRef.current = true;
    setPage(1); setMore(true);
    try { await load(1); } finally { setRefreshing(false); }
  }, [load]);

  // Available variant options (colors/sizes/shapes) scoped to the current category & type — like the web.
  useEffect(() => {
    const vp = {};
    if (selCats.length) vp.category_ids = selCats.join(',');
    if (selType) vp.type = selType;
    api.products.getVariantSummary(vp)
      .then(({ data }) => setVariantOpts({ colors: data?.colors || [], sizes: data?.sizes || [], shapes: data?.shapes || [] }))
      .catch(() => setVariantOpts({ colors: [], sizes: [], shapes: [] }));
  }, [selCats, selType]);

  // Apply a category/type tapped in the header CategoryBar or Home (route params update while mounted)
  useEffect(() => {
    if (route.params?.categoryId !== undefined) setSelCats(route.params.categoryId ? [route.params.categoryId] : []);
    if (route.params?.type !== undefined) setSelType(route.params.type || null);
  }, [route.params?.categoryId, route.params?.type]); // eslint-disable-line

  // Map every category id → its top-level (level-1) ancestor id, from the tree.
  const topAncestorMap = useMemo(() => {
    const map = {};
    const walk = (nodes, rootId) => (nodes || []).forEach((n) => {
      const root = rootId || n.id; // a top-level node is its own root
      map[n.id] = root;
      walk(n.children || n.subcategories || [], root);
    });
    walk(cats, null);
    return map;
  }, [cats]);

  // Reflect the filter's category selection in the top category bar:
  //  • one category (any level) → its top-level ancestor pill lights up
  //  • many, all under ONE top-level parent → that parent pill
  //  • many spanning DIFFERENT top-level parents → nothing (sentinel, so even "All" is off)
  const activeTopCat = useMemo(() => {
    if (!selCats.length) return null;
    const roots = new Set(selCats.map((id) => topAncestorMap[id] || id));
    return roots.size === 1 ? [...roots][0] : '__multi__';
  }, [selCats, topAncestorMap]);
  useEffect(() => { navigation.setParams({ activeTopCat }); }, [activeTopCat]); // eslint-disable-line

  // Build rows: pairs of products, with sponsored rails injected between blocks
  const { rows, leftoverSponsored } = useMemo(() => {
    const out = [];
    let spIdx = 0;
    for (let i = 0; i < products.length; i += 2) {
      out.push({ type: 'row', key: `r${i}`, items: products.slice(i, i + 2) });
      const rowNo = out.filter((r) => r.type === 'row').length;
      if (rowNo % BLOCK_ROWS === 0 && sponsored.length) {
        const slice = sponsored.slice(spIdx, spIdx + 6);
        if (slice.length) { out.push({ type: 'sponsored', key: `s${i}`, items: slice }); spIdx += slice.length; }
      }
    }
    return { rows: out, leftoverSponsored: sponsored.slice(spIdx) };
  }, [products, sponsored]);

  // Drive category selection through the route param so the top CategoryBar's
  // active pill always mirrors the shown category (route param -> effect -> selCats + reload).
  const setCategory = useCallback((id, name) => {
    navigation.setParams({ categoryId: id ?? null, categoryName: id ? (name ?? null) : null });
  }, [navigation]);
  const pickCat = (c) => setCategory(selCats.includes(c.id) ? null : c.id, c.name);

  // ── Swipe between categories — a real pager: neighbours peek in while dragging,
  //    and the swiped-to page springs into place on release. ──
  const catNav = useMemo(() => [{ id: null, name: 'All' }, ...cats.map((c) => ({ id: c.id, name: c.name }))], [cats]);
  const curCatIdx = useMemo(() => {
    const cur = selCats[0] ?? null;
    const i = catNav.findIndex((c) => c.id === cur);
    return i < 0 ? 0 : i;
  }, [catNav, selCats]);
  const lastIdx = catNav.length - 1;

  // Pre-fetch the neighbouring categories' first products so they can be shown LIVE while swiping.
  useEffect(() => {
    let cancelled = false;
    const s = SORTS.find((x) => x.key === sort);
    const base = { page: 1, limit: 8, ...(selType ? { type: selType } : {}), ...(s?.sort_by ? { sort_by: s.sort_by } : {}) };
    const fetchFor = (idx) => {
      if (idx < 0 || idx > lastIdx) return Promise.resolve([]);
      const c = catNav[idx];
      return api.products.getAll({ ...base, ...(c.id ? { category_ids: c.id } : {}) })
        .then(({ data }) => (Array.isArray(data) ? data : data?.products || []).slice(0, 8)).catch(() => []);
    };
    Promise.all([fetchFor(curCatIdx - 1), fetchFor(curCatIdx + 1)]).then(([prev, next]) => { if (!cancelled) setAdj({ prev, next }); });
    return () => { cancelled = true; };
  }, [curCatIdx, catNav, lastIdx, selType, sort]);

  const tx = useSharedValue(0);
  // The release glide already parked the incoming page at centre (tx = ∓W). Once it
  // becomes the current page, recentre without animating: identical pixels, so the
  // swap is invisible. A category-bar tap lands here with tx already 0 (a no-op).
  useEffect(() => {
    tx.value = 0;
    // List stays mounted across category swipes (no remount lag) — just snap it back to the top.
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [curCatIdx]); // eslint-disable-line
  const curStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  // Commit a swipe: seed the grid with the neighbour's pre-fetched products (so the new page shows
  // instantly with no skeleton), then switch category — the background reload refreshes it.
  const commitSwipe = useCallback((step) => {
    const next = curCatIdx + step;
    if (next < 0 || next > lastIdx) return;
    const nc = catNav[next];
    seedRef.current = true;
    setLoading(false);
    setProducts(step > 0 ? adj.next : adj.prev);
    setCategory(nc.id, nc.name);
  }, [curCatIdx, lastIdx, catNav, adj, setCategory]);

  const swipeCats = useMemo(() => Gesture.Pan()
    .activeOffsetX([-18, 18])   // claim horizontal drags (card image pagers win first — they activate sooner)
    .failOffsetY([-14, 14])     // …and yield to vertical scrolling
    .onUpdate((e) => {
      'worklet';
      let x = e.translationX;
      if ((curCatIdx <= 0 && x > 0) || (curCatIdx >= lastIdx && x < 0)) x *= 0.25; // rubber-band past the ends
      tx.value = Math.max(-W, Math.min(W, x)); // full finger-follow → the page moves with you
    })
    .onEnd((e) => {
      'worklet';
      const threshold = W * 0.16; // easy to trigger → very flexible
      const goPrev = (e.translationX > threshold || (e.velocityX > 350 && e.translationX > 4)) && curCatIdx > 0;
      const goNext = (e.translationX < -threshold || (e.velocityX < -350 && e.translationX < -4)) && curCatIdx < lastIdx;
      const step = goNext ? 1 : goPrev ? -1 : 0;
      if (!step) {
        tx.value = withTiming(0, { duration: 110, easing: Easing.out(Easing.cubic) }); // not far enough → snap back
        return;
      }
      // Carry the drag through to the edge on the UI thread FIRST, then commit.
      // Committing on release instead left the page frozen wherever the finger let
      // go while React re-rendered the grid, then jumped it — that was the stutter.
      // Here the peeked page simply glides to centre; the state swap lands after,
      // on identical pixels, so it can't be seen.
      tx.value = withTiming(-step * W, { duration: 130, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(commitSwipe)(step);
      });
    }), [curCatIdx, lastIdx, W, commitSwipe, tx]);
  const pageTitle = selCats.length ? (cats.find((c) => c.id === selCats[0])?.name || route.params?.categoryName || 'Category') : 'All Products';
  const sortLabelCur = SORTS.find((s) => s.key === sort)?.label;

  const Header = (
    <View style={styles.headerWrap}>
      {/* Gradient title + underline (mirrors the web products-page-title) */}
      <Text style={styles.pageTitle} numberOfLines={1}>{pageTitle}</Text>
      <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleBar} />

      {/* Browse all → "Shop by Category"; category selected → "Shop by Sub-category" + sponsored band */}
      {selCats.length === 0
        ? <CategoryShowcase cats={cats} onPick={pickCat} />
        : <>
            <SubCategoryShowcase categoryId={selCats[0]} onPick={(sub) => setSelCats([sub.id])} />
            <CategorySponsoredBand sponsored={sponsored} familyIds={selCats} catName={pageTitle} />
          </>}

      {/* Count + Sort row */}
      <View style={[styles.countRow, { marginTop: 14 }]}>
        <Text style={styles.countText}><Text style={styles.countNum}>{products.length}</Text> products</Text>
        <TouchableOpacity style={styles.sortTrigger} onPress={() => setSortOpen(true)} activeOpacity={0.8}>
          <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
          <Text style={styles.sortTriggerText} numberOfLines={1}>{sortLabelCur}</Text>
          <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Full-screen skeleton ONLY on the first load. While the filter modal is open, changing a
  // filter must NOT unmount the tree (that would close/reset the modal) — the products reload
  // underneath and the modal stays fixed.
  if (loading && !filterOpen) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {Header}
        <View style={styles.skelGrid}>
          {[...Array(6)].map((_, i) => <ProductCardSkeleton key={i} style={{ width: '48.5%', marginBottom: 6 }} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <GestureDetector gesture={swipeCats}>
      <View style={{ flex: 1, overflow: 'hidden' }}>
      {/* Live neighbour peeks — slide in from the edges as you drag */}
      {curCatIdx > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.peek, { left: -W, width: W }, curStyle]}>
          <PeekPage title={catNav[curCatIdx - 1].name} catId={catNav[curCatIdx - 1].id} products={adj.prev} cats={cats} onPick={pickCat} />
        </Animated.View>
      ) : null}
      {curCatIdx < lastIdx ? (
        <Animated.View pointerEvents="none" style={[styles.peek, { left: W, width: W }, curStyle]}>
          <PeekPage title={catNav[curCatIdx + 1].name} catId={catNav[curCatIdx + 1].id} products={adj.next} cats={cats} onPick={pickCat} />
        </Animated.View>
      ) : null}
      {/* Current page */}
      <Animated.View style={[{ flex: 1 }, curStyle]}>
      <Animated.View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingBottom: TAB_SPACE }}
        showsVerticalScrollIndicator={false}
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        {...listPerfProps}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (more && !loadingMore) load(page);
          else if (activeFilters > 0 && !more && recMore && !recLoading && recStarted.current) loadRecs(recPage);
        }}
        ListEmptyComponent={<Empty icon="cube-outline" title="No products found" subtitle="Try adjusting your filters." />}
        ListFooterComponent={
          <>
            {!more && leftoverSponsored.length > 0 && (
              <View style={styles.leftoverWrap} testID="sponsored-products-leftover">
                <View style={styles.bandHead}>
                  <View style={styles.bandPill}><Ionicons name="megaphone" size={12} color="#b45309" /><Text style={styles.bandPillText}>More Sponsored Products</Text></View>
                  <Text style={styles.bandSub}>Sponsored picks you haven't seen yet</Text>
                </View>
                <View style={styles.leftoverGrid}>
                  {leftoverSponsored.map((p) => <View key={`lo-${p.id}`} style={styles.leftoverCell}><ProductCard product={p} isSponsored showShopName /></View>)}
                </View>
              </View>
            )}
            {loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null}

            {/* End-of-page discovery sections — only when a filter is active and the filtered
                results are exhausted. Sponsored add-ons (fixed curated set) + Recommended picks
                (infinite-scroll grid with a skeleton tail). */}
            {activeFilters > 0 && !more ? (
              <>
                <SponsoredAddOns />
                {recs.length > 0 ? <RecommendedHeader /> : null}
                {recs.length > 0 ? (
                  <View style={styles.leftoverGrid} testID="shop-recommended-picks">
                    {recs.map((p) => <View key={`rec-${p.id}`} style={styles.leftoverCell}><ProductCard product={p} showShopName /></View>)}
                  </View>
                ) : null}
                {recLoading ? (
                  <View style={styles.skelGrid}>
                    {[...Array(4)].map((_, i) => <ProductCardSkeleton key={i} style={{ width: '48.5%', marginBottom: 6 }} />)}
                  </View>
                ) : null}
                {!recMore && recs.length > 0 ? <Text style={styles.end}>End of results</Text> : null}
              </>
            ) : (!more && products.length > 0 ? <Text style={styles.end}>End of results</Text> : null)}
          </>
        }
        renderItem={({ item }) => {
          if (item.type === 'sponsored') {
            return (
              <View style={styles.spBlock}>
                <View style={styles.spHead}>
                  <View style={styles.spPill}><Ionicons name="megaphone" size={13} color={colors.amber} /><Text style={styles.spPillText}>Sponsored picks</Text></View>
                </View>
                <FlatList
                  data={item.items}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(p, i) => p.id || String(i)}
                  contentContainerStyle={{ paddingHorizontal: 10, gap: 8 }}
                  snapToInterval={158}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  overScrollMode="always"
                  bounces
                  renderItem={({ item: p }) => <ProductCard product={p} isSponsored showShopName style={{ width: 150 }} />}
                />
              </View>
            );
          }
          return (
            <View style={styles.gridRow}>
              {item.items.map((p) => <View key={p.id} style={{ flex: 1, marginHorizontal: 1 }}><ProductCard product={p} showShopName pageGesture={swipeCats} /></View>)}
              {item.items.length === 1 && <View style={{ flex: 1, marginHorizontal: 1 }} />}
            </View>
          );
        }}
      />
      </Animated.View>
      </Animated.View>
      </View>
      </GestureDetector>

      {/* Floating Filters FAB (mirrors the web mobile-filter-fab) */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setFilterOpen(true)}>
        <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabInner}>
          <Ionicons name="options" size={16} color={colors.white} />
          <Text style={styles.fabText}>Filters{activeFilters > 0 ? ` · ${activeFilters}` : ''}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <SortSheet open={sortOpen} onClose={() => setSortOpen(false)} value={sort} onSelect={(k) => { setSort(k); setSortOpen(false); }} />
      <FilterSheet
        open={filterOpen} onClose={() => setFilterOpen(false)}
        cats={cats} selCats={selCats} setSelCats={setSelCats}
        selType={selType} setSelType={setSelType}
        priceMin={priceMin} setPriceMin={setPriceMin} priceMax={priceMax} setPriceMax={setPriceMax}
        discMin={discMin} setDiscMin={setDiscMin} discMax={discMax} setDiscMax={setDiscMax}
        variantOpts={variantOpts} catCounts={catCounts}
        selColors={selColors} setSelColors={setSelColors}
        selSizes={selSizes} setSelSizes={setSelSizes}
        selShapes={selShapes} setSelShapes={setSelShapes}
        onClear={() => { setSelCats([]); setSelType(null); setPriceMin(''); setPriceMax(''); setDiscMin(''); setDiscMax(''); setSelColors([]); setSelSizes([]); setSelShapes([]); }}
      />
      <RefreshIndicator refreshing={refreshing} top={6} />
    </View>
  );
}

/* "Featured in {Category}" — sponsored products for the selected category */
function CategorySponsoredBand({ sponsored, familyIds, catName }) {
  const items = React.useMemo(() => {
    if (!familyIds?.length || !sponsored?.length) return [];
    const set = new Set(familyIds);
    return sponsored.filter((p) => [p.category_id, ...(p.category_ids || [])].filter(Boolean).some((id) => set.has(id))).slice(0, 12);
  }, [sponsored, familyIds]);
  if (!items.length) return null;
  return (
    <View style={styles.bandWrap} testID="sponsored-category-band">
      <View style={styles.bandHead}>
        <View style={styles.bandPill}><Ionicons name="megaphone" size={12} color="#b45309" /><Text style={styles.bandPillText}>Featured in {catName}</Text></View>
        <Text style={styles.bandSub}>Sponsored picks in this category</Text>
      </View>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p, i) => p.id || String(i)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        snapToInterval={160}
        snapToAlignment="start"
        decelerationRate="fast"
        renderItem={({ item: p }) => <ProductCard product={p} isSponsored showShopName style={{ width: 150 }} />}
      />
    </View>
  );
}

/* Shop by Category — horizontal photo carousel (mirrors the web categories-section) */
/* One "Shop by Category" square — creative: gradient fallback chip with gloss,
   glass count badge, has-children chevron, spring press + staggered entrance. */
function CatCard({ cat, index, width, grad, onPick }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const thumb = width - 8;
  return (
    <View style={{ width }}>
      <Animated.View style={aStyle}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 14 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={() => onPick(cat)}
        style={styles.ccCard}
        testID={`category-card-${cat.id}`}
      >
        <View style={[styles.ccThumb, { width: thumb, height: thumb }]}>
          {cat.preview_image
            ? <Image source={{ uri: img(cat.preview_image) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : (
              <View style={styles.ccFallback}>
                <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ccChip}>
                  <View style={styles.ccChipGloss} />
                  <Ionicons name="grid" size={13} color="rgba(255,255,255,0.92)" />
                </LinearGradient>
              </View>
            )}
          {/* creative top sheen tinted by the card's gradient */}
          <LinearGradient colors={[`${grad[0]}55`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.ccSheen} pointerEvents="none" />
          {cat.product_count > 0 ? <View style={styles.ccCount}><Text style={styles.ccCountText}>{cat.product_count}</Text></View> : null}
          {cat.has_children ? <View style={styles.ccChevron}><Ionicons name="chevron-forward" size={9} color={colors.white} /></View> : null}
        </View>
        <Text style={styles.ccName} numberOfLines={2}>{cat.name}</Text>
      </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

/* Shared 5-per-row creative card grid — used by both the category & sub-category showcases. */
/* Skeleton tile matching CatCard (thumb + name line). */
function CatCardSkeleton({ width }) {
  const thumb = width - 8;
  return (
    <View style={{ width }}>
      <View style={styles.ccCard}>
        <SkeletonBlock width={thumb} height={thumb} radius={9} />
        <SkeletonBlock width={thumb * 0.72} height={8} radius={3} style={{ marginTop: 2 }} />
      </View>
    </View>
  );
}

/* Preview of a neighbouring category shown live while dragging toward it: title +
   the same "Shop by Category / Sub-category" cards as the real page + its first products. */
function PeekPage({ title, catId, products, cats, onPick }) {
  const list = (products && products.length) ? products.slice(0, 4) : [0, 1];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Text style={styles.pageTitle} numberOfLines={1}>{title === 'All' ? 'All Products' : title}</Text>
      <LinearGradient colors={[colors.p500, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.titleBar} />
      {catId
        ? <SubCategoryShowcase categoryId={catId} onPick={onPick} />
        : <CategoryShowcase cats={cats} onPick={onPick} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 9, marginTop: 12 }}>
        {list.map((p, i) => (
          <View key={p?.id || i} style={{ width: '50%', paddingHorizontal: 1, marginBottom: 4 }}>
            {p?.id ? <ProductCard product={p} showShopName /> : <ProductCardSkeleton />}
          </View>
        ))}
      </View>
    </View>
  );
}

function CardGrid({ icon, title, unit, list, onPick, testID, loading }) {
  const { width: winW } = useWindowDimensions();
  const GAP = 7, PAD = 14;
  const cardW = (winW - PAD * 2 - GAP * 4) / 5;
  if (!list.length && !loading) return null; // nothing to show and not loading → hide
  return (
    <View style={styles.ccSection} testID={testID}>
      <View style={[styles.ccGrid, { paddingHorizontal: PAD, gap: GAP }]}>
        {list.length
          ? list.map((cat, i) => <CatCard key={cat.id || i} cat={cat} index={i} width={cardW} grad={CAT_GRAD[i % CAT_GRAD.length]} onPick={onPick} />)
          : [...Array(5)].map((_, i) => <CatCardSkeleton key={i} width={cardW} />)}
      </View>
    </View>
  );
}

// Module caches so the showcase data is shown INSTANTLY (no skeleton reload) once fetched —
// the peek and the committed page share these, so swiping in doesn't re-trigger a load.
let _topCatCache = null;              // top-level preview categories
const _subcatCache = new Map();       // categoryId -> children preview

/* "Shop by Category" — top-level categories (mirrors the web CategoryCards). */
function CategoryShowcase({ cats, onPick }) {
  const [items, setItems] = useState(_topCatCache);
  useEffect(() => {
    let cancelled = false;
    api.categories.getTopLevelWithPreview()
      .then(({ data }) => { const c = data?.categories || []; _topCatCache = c; if (!cancelled) setItems(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // Prefer the preview endpoint; fall back to the tree cats passed in.
  const list = (items && items.length)
    ? items
    : (cats || []).map((c) => ({ id: c.id, name: c.name, preview_image: c.image || c.image_url, product_count: c.product_count, has_children: (c.children || c.subcategories || []).length > 0 }));
  return <CardGrid icon="grid" title="Shop by Category" unit="categories" list={list} onPick={onPick} testID="category-cards" loading={items === null && list.length === 0} />;
}

/* "Shop by Sub-category" — children of the selected category (same creative grid). */
function SubCategoryShowcase({ categoryId, onPick }) {
  const [items, setItems] = useState(() => (categoryId && _subcatCache.has(categoryId)) ? _subcatCache.get(categoryId) : null);
  useEffect(() => {
    let cancelled = false;
    if (!categoryId) { setItems(null); return; }
    setItems(_subcatCache.has(categoryId) ? _subcatCache.get(categoryId) : null); // cached → instant, else skeleton
    api.categories.getChildrenWithPreview(categoryId)
      .then(({ data }) => { const ch = data?.children || []; _subcatCache.set(categoryId, ch); if (!cancelled) setItems(ch); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [categoryId]);
  const list = items || [];
  return <CardGrid icon="git-branch" title="Shop by Sub-category" unit={list.length === 1 ? 'subcategory' : 'subcategories'} list={list} onPick={onPick} testID="subcategory-cards" loading={categoryId ? items === null : false} />;
}

function SortSheet({ open, onClose, value, onSelect }) {
  return (
    <BottomSheet visible={open} onClose={onClose}>
      <View style={styles.sheetHeadRow}>
        <View style={styles.sheetTitleRow}><View style={styles.titleTile}><Ionicons name="swap-vertical" size={15} color={colors.white} /></View><Text style={styles.sheetTitle}>Sort by</Text></View>
      </View>
      <View style={{ gap: 8, marginTop: 4 }}>
        {SORTS.map((s) => {
          const on = value === s.key;
          return (
            <TouchableOpacity key={s.key} activeOpacity={0.85} onPress={() => onSelect(s.key)}>
              {on ? (
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sortOptOn}>
                  <View style={styles.sortIconOn}><Ionicons name={s.icon} size={16} color={colors.white} /></View>
                  <Text style={styles.sortLabelOn}>{s.label}</Text>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                </LinearGradient>
              ) : (
                <View style={styles.sortOpt}>
                  <View style={styles.sortIcon}><Ionicons name={s.icon} size={16} color={colors.violet} /></View>
                  <Text style={styles.sortLabel}>{s.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

/* ---- Expandable multi-select category tree (mirrors the web CategoryTreeFilter) ---- */
const childrenOf = (node) => node.children || node.subcategories || [];
// Sum this node + all descendants (mirrors the web: a product tagged to several nodes counts at each).
const subtreeCount = (node, counts) => childrenOf(node).reduce((n, c) => n + subtreeCount(c, counts), counts[node.id] || 0);
const hasSelectedDescendant = (node, selected) =>
  selected.includes(node.id) || childrenOf(node).some((c) => hasSelectedDescendant(c, selected));

function CatTreeNode({ node, depth, expanded, toggleExpand, selected, onToggle, counts }) {
  const kids = childrenOf(node);
  const hasKids = kids.length > 0;
  const isExp = expanded.has(node.id);
  const isSel = selected.includes(node.id);
  const partial = !isSel && hasKids && hasSelectedDescendant(node, selected);
  const count = subtreeCount(node, counts);
  return (
    <View>
      <View style={[styles.treeRow, { paddingLeft: depth * 16 }]}>
        {hasKids ? (
          <TouchableOpacity onPress={() => toggleExpand(node.id)} style={styles.treeChevron} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID={`filter-toggle-${node.id}`}>
            <Ionicons name={isExp ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ) : <View style={styles.treeChevron} />}
        <TouchableOpacity style={styles.treeLabelRow} activeOpacity={0.7} onPress={() => onToggle(node.id)} testID={`category-filter-${node.id}`}>
          <View style={[styles.treeCheck, isSel && styles.treeCheckOn, partial && styles.treeCheckPartial]}>
            {isSel ? <Ionicons name="checkmark" size={12} color={colors.white} /> : partial ? <View style={styles.treeDash} /> : null}
          </View>
          <Text style={[styles.treeLabel, isSel && styles.treeLabelOn]} numberOfLines={1}>{node.name}</Text>
          {count > 0 ? <Text style={styles.treeCount}>({count})</Text> : null}
        </TouchableOpacity>
      </View>
      {hasKids && isExp ? (
        <View style={styles.treeChildren}>
          {kids.map((c) => <CatTreeNode key={c.id} node={c} depth={depth + 1} expanded={expanded} toggleExpand={toggleExpand} selected={selected} onToggle={onToggle} counts={counts} />)}
        </View>
      ) : null}
    </View>
  );
}

function CategoryTree({ tree, selected, onToggle, counts = {} }) {
  const [expanded, setExpanded] = useState(() => new Set());
  // Auto-expand ancestors of any pre-selected category (once).
  useEffect(() => {
    if (!selected.length || !tree.length) return;
    const acc = new Set();
    const walk = (nodes, ancestors) => nodes.forEach((n) => {
      if (selected.includes(n.id)) ancestors.forEach((a) => acc.add(a));
      walk(childrenOf(n), [...ancestors, n.id]);
    });
    walk(tree, []);
    if (acc.size) setExpanded((prev) => new Set([...prev, ...acc]));
  }, []); // eslint-disable-line
  const toggleExpand = (id) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  if (!tree.length) return <Text style={styles.treeEmpty}>No categories available</Text>;
  return <View testID="category-tree-filter">{tree.map((c) => <CatTreeNode key={c.id} node={c} depth={0} expanded={expanded} toggleExpand={toggleExpand} selected={selected} onToggle={onToggle} counts={counts} />)}</View>;
}

function FilterSheet({ open, onClose, cats, selCats, setSelCats, selType, setSelType, priceMin, setPriceMin, priceMax, setPriceMax, discMin, setDiscMin, discMax, setDiscMax, variantOpts, catCounts, selColors, setSelColors, selSizes, setSelSizes, selShapes, setSelShapes, onClear }) {
  const toggleIn = (setter) => (name) => setter((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  const toggleCat = toggleIn(setSelCats); // multi-select category tree (sends category_ids, like the web)
  const toggleColor = toggleIn(setSelColors);
  const toggleSize = toggleIn(setSelSizes);
  const toggleShape = toggleIn(setSelShapes);
  const anyFilter = selCats.length || selType || priceMin || priceMax || discMin || discMax || selColors.length || selSizes.length || selShapes.length;
  return (
    <BottomSheet visible={open} onClose={onClose} maxHeight="88%">
      <View style={styles.sheetHeadRow}>
        <View style={styles.sheetTitleRow}><View style={styles.titleTile}><Ionicons name="options" size={15} color={colors.white} /></View><Text style={styles.sheetTitle}>Filters</Text></View>
        {anyFilter ? <TouchableOpacity style={styles.clearChip} onPress={onClear}><Ionicons name="close" size={12} color={colors.sale} /><Text style={styles.clearText}>Clear all</Text></TouchableOpacity> : null}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.fLabel}>TYPE</Text>
        <View style={styles.chipWrap}>
          {TYPES.map((t) => {
            const on = selType === t.key;
            return on ? (
              <TouchableOpacity key={t.key} onPress={() => setSelType(null)} activeOpacity={0.85}>
                <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipOnGrad}><Text style={styles.chipTextOn}>{t.label}</Text></LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity key={t.key} style={styles.chip} onPress={() => setSelType(t.key)}><Text style={styles.chipText}>{t.label}</Text></TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fLabel}>CATEGORIES</Text>
        <CategoryTree tree={cats} selected={selCats} onToggle={toggleCat} counts={catCounts} />

        <Text style={styles.fLabel}>PRICE RANGE</Text>
        <View style={styles.priceRow}>
          <View style={styles.priceBox}><Text style={styles.priceCur}>$</Text><TextInput style={styles.priceInput} placeholder="Min" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={priceMin} onChangeText={setPriceMin} /></View>
          <View style={styles.priceDash} />
          <View style={styles.priceBox}><Text style={styles.priceCur}>$</Text><TextInput style={styles.priceInput} placeholder="Max" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={priceMax} onChangeText={setPriceMax} /></View>
        </View>

        <Text style={styles.fLabel}>DISCOUNT %</Text>
        <View style={styles.priceRow}>
          <View style={styles.priceBox}><TextInput style={styles.priceInput} placeholder="Min" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={discMin} onChangeText={setDiscMin} /><Text style={styles.priceCur}>%</Text></View>
          <View style={styles.priceDash} />
          <View style={styles.priceBox}><TextInput style={styles.priceInput} placeholder="Max" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={discMax} onChangeText={setDiscMax} /><Text style={styles.priceCur}>%</Text></View>
        </View>

        {variantOpts.colors.length > 0 ? (
          <>
            <Text style={styles.fLabel}>COLORS</Text>
            <View style={styles.chipWrap}>
              {variantOpts.colors.map((c) => {
                const on = selColors.includes(c.name);
                return (
                  <TouchableOpacity key={c.name} activeOpacity={0.85} onPress={() => toggleColor(c.name)} style={[styles.colorChip, on && styles.colorChipOn]}>
                    <View style={[styles.swatch, { backgroundColor: c.color_code || '#ccc' }]} />
                    <Text style={[styles.chipText, on && { color: colors.violet700, fontFamily: fonts.bold }]}>{c.name}</Text>
                    {on ? <Ionicons name="checkmark-circle" size={13} color={colors.violet} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        {variantOpts.sizes.length > 0 ? (
          <>
            <Text style={styles.fLabel}>SIZES</Text>
            <View style={styles.chipWrap}>
              {variantOpts.sizes.map((s) => (selSizes.includes(s.name) ? (
                <TouchableOpacity key={s.name} onPress={() => toggleSize(s.name)} activeOpacity={0.85}>
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipOnGrad}><Text style={styles.chipTextOn}>{s.name}</Text></LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={s.name} style={styles.chip} onPress={() => toggleSize(s.name)}><Text style={styles.chipText}>{s.name}</Text></TouchableOpacity>
              )))}
            </View>
          </>
        ) : null}

        {variantOpts.shapes.length > 0 ? (
          <>
            <Text style={styles.fLabel}>SHAPES</Text>
            <View style={styles.chipWrap}>
              {variantOpts.shapes.map((s) => (selShapes.includes(s.name) ? (
                <TouchableOpacity key={s.name} onPress={() => toggleShape(s.name)} activeOpacity={0.85}>
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chipOnGrad}><Text style={styles.chipTextOn}>{s.name}</Text></LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity key={s.name} style={styles.chip} onPress={() => toggleShape(s.name)}><Text style={styles.chipText}>{s.name}</Text></TouchableOpacity>
              )))}
            </View>
          </>
        ) : null}

        <View style={{ height: 10 }} />
      </ScrollView>
      <TouchableOpacity style={{ marginTop: 12 }} activeOpacity={0.9} onPress={onClose}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.applyInner}>
          <Ionicons name="checkmark-done" size={17} color={colors.white} />
          <Text style={styles.applyText}>Show results</Text>
        </LinearGradient>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingTop: 6 },
  peek: { position: 'absolute', top: 0, bottom: 0 },
  pageTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.primarySoftText, letterSpacing: -0.5, paddingHorizontal: 16 },
  titleBar: { width: 44, height: 3, borderRadius: 2, marginTop: 5, marginBottom: 2, marginHorizontal: 16 },
  searchPill: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, height: 46, ...shadow.card },
  searchPillText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  countText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  countNum: { fontFamily: fonts.extrabold, color: colors.ink },
  sortTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.surface, maxWidth: 180 },
  sortTriggerText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text, flexShrink: 1 },
  fab: { position: 'absolute', right: 16, bottom: 96 },
  fabInner: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, ...shadow.violetGlow },
  fabText: { color: colors.white, fontFamily: fonts.bold, fontSize: 11.5 },
  subBack: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  subBackText: { fontFamily: fonts.bold, fontSize: 12, color: colors.violet },
  subChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  subChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  subWrap: { marginTop: 10, marginBottom: 2 },
  subHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, marginBottom: 10 },
  subHeadText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  subHeadCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 },
  subCard: { alignItems: 'center', gap: 4 },
  subThumb: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight },
  subCountBadge: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1 },
  subCountText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 8 },
  subChevron: { position: 'absolute', bottom: 3, right: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  subName: { fontFamily: fonts.semibold, fontSize: 9.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 12 },
  bandWrap: { marginTop: 14, marginBottom: 4 },
  bandHead: { paddingHorizontal: 16, marginBottom: 10 },
  bandPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  bandPillText: { fontFamily: fonts.bold, fontSize: 12, color: '#b45309' },
  bandSub: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 4 },
  leftoverWrap: { marginTop: 18, marginBottom: 6 },
  leftoverGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 11 },
  leftoverCell: { width: '50%', paddingHorizontal: 1, marginBottom: 2 },
  ccSection: { marginTop: 10, marginBottom: 4 },
  ccHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 },
  ccHeadTile: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 7 },
  ccHeadTitle: { fontFamily: fonts.extrabold, fontSize: 14.5, color: colors.text, letterSpacing: -0.3 },
  ccHeadCount: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted },
  ccGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  ccCard: { width: '100%', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 12, padding: 3, ...shadow.card },
  ccThumb: { borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  ccFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  ccChip: { width: '52%', height: '52%', borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ccChipGloss: { position: 'absolute', top: 2, left: 3, width: '55%', height: '40%', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.35)' },
  ccSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  ccCount: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: 4.5, paddingVertical: 1 },
  ccCountText: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 8, letterSpacing: 0.3 },
  ccChevron: { position: 'absolute', bottom: 3, right: 3, width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  ccName: { fontFamily: fonts.semibold, fontSize: 8.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 11 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 10, marginBottom: 8, padding: 16, borderRadius: radius.lg, ...shadow.violetGlow },
  promoTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19, letterSpacing: -0.4 },
  promoSub: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  promoIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingBottom: 8 },
  barBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  barBtnActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  barBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  gridRow: { flexDirection: 'row', paddingHorizontal: 9, marginBottom: 4 },
  spBlock: { marginVertical: 8, paddingVertical: 10, backgroundColor: '#fffbeb' },
  spHead: { paddingHorizontal: 12, marginBottom: 8 },
  spPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  spPillText: { fontFamily: fonts.semibold, fontSize: 12, color: '#b45309' },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 9, paddingTop: 4 },
  end: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.medium, marginVertical: 18 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  sheetHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  clearText: { fontFamily: fonts.semibold, color: colors.violet, fontSize: 13 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  sortLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  titleTile: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  sortOpt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface },
  sortOptOn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, ...shadow.violetGlow },
  sortIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sortIconOn: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  sortLabelOn: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.white },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.saleSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  chipOnGrad: { borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 9 },
  chipTextOn: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  catChipOn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 9 },
  priceBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, height: 48 },
  priceCur: { fontFamily: fonts.bold, fontSize: 15, color: colors.textMuted },
  priceDash: { width: 12, height: 2, borderRadius: 1, backgroundColor: colors.border },
  fLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  treeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  treeChevron: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  treeLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  treeCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  treeCheckOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  treeCheckPartial: { borderColor: colors.violet },
  treeDash: { width: 9, height: 2, borderRadius: 1, backgroundColor: colors.violet },
  treeLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  treeLabelOn: { fontFamily: fonts.bold, color: colors.violet700 },
  treeCount: { fontFamily: fonts.body, fontSize: 10.5, color: colors.textMuted },
  treeChildren: { borderLeftWidth: 1, borderLeftColor: colors.borderLight, marginLeft: 11 },
  treeEmpty: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, paddingVertical: 8 },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  colorChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.violet },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.violet },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  catLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  applyBtn: { marginTop: 12 },
  applyInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md, ...shadow.violetGlow },
  applyText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
