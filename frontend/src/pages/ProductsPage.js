import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ArrowUpDown, Sparkles } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import CategoryTreeFilter from '../components/CategoryTreeFilter';
import VariantFilters from '../components/VariantFilters';
import SubCategoryCards from '../components/SubCategoryCards';
import CategoryCards from '../components/CategoryCards';
import SponsoredRow from '../components/SponsoredRow';
import AISmartSearch from '../components/AISmartSearch';
import { useSponsoredSettings } from '../hooks/useSponsoredSettings';
import { useDeviceTier } from '../hooks/useDeviceTier';
import { ProductCardSkeleton, LoadingMoreSpinner, EndOfListMessage } from '../components/InfiniteScrollHelpers';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '../lib/i18n';

const ProductsPage = () => {
  const { t } = useLanguage();
  const { sponsoredEnabledFor } = useSponsoredSettings();
  const { blockSize, cardsPerCarousel, threshold: carouselThreshold } = useDeviceTier();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [sortedProducts, setSortedProducts] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [discountRange, setDiscountRange] = useState([0, 100]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedShapes, setSelectedShapes] = useState([]);
  const [sortBy, setSortBy] = useState('recommended');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Robustly lock background scroll when mobile filters are open.
  // Uses the position:fixed technique so iOS Safari / Android also stay locked,
  // and restores the exact scroll position on close.
  const lockedScrollYRef = useRef(0);
  useEffect(() => {
    const body = document.body;
    if (mobileFiltersOpen) {
      lockedScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${lockedScrollYRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
    } else {
      body.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      if (lockedScrollYRef.current) {
        window.scrollTo(0, lockedScrollYRef.current);
        lockedScrollYRef.current = 0;
      }
    }
    return () => {
      body.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
    };
  }, [mobileFiltersOpen]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const PRODUCTS_PER_PAGE = 12;
  const [boostedProducts, setBoostedProducts] = useState([]);
  const [pageTitle, setPageTitle] = useState(t('products.title'));
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);
  const filtersSidebarRef = useRef(null);
  
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedPriceRange, setDebouncedPriceRange] = useState([0, 1000]);
  const [debouncedDiscountRange, setDebouncedDiscountRange] = useState([0, 100]);
  const priceDebounceRef = useRef(null);
  const discountDebounceRef = useRef(null);
  
  // Constants for slider ranges
  const MAX_PRICE = 1000;
  const MAX_DISCOUNT = 100;
  
  // Helper to find category name by ID
  const findCategoryName = (categories, id) => {
    for (const cat of categories) {
      if (cat.id === id) return cat.name;
      if (cat.children) {
        const found = findCategoryName(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Collect every id in a category subtree (including the node itself)
  const collectSubtreeIds = (node) => {
    let ids = [node.id];
    (node.children || []).forEach((c) => {
      ids = ids.concat(collectSubtreeIds(c));
    });
    return ids;
  };

  // Given a selected category id, return ALL ids in its whole FAMILY tree
  // (the top-level ancestor + every descendant). Used so the "Featured in {Category}"
  // band shows sponsored products from the entire family, not just the exact category.
  const getFamilyCategoryIds = (categories, id) => {
    if (!id) return [];
    for (const root of categories) {
      const subtree = collectSubtreeIds(root);
      if (subtree.includes(id)) return subtree;
    }
    return [id];
  };
  
  // Update page title based on filters
  const updatePageTitle = () => {
    const parts = [];
    
    // Type filter
    if (selectedType && selectedType !== 'all') {
      parts.push(selectedType.charAt(0).toUpperCase() + selectedType.slice(1) + "'s");
    }
    
    // Category filter
    if (selectedCategories.length > 0 && categoryTree.length > 0) {
      const categoryName = findCategoryName(categoryTree, selectedCategories[0]);
      if (categoryName) {
        parts.push(categoryName);
      }
    }
    
    // Search filter
    if (search) {
      parts.push(`"${search}"`);
    }
    
    if (parts.length > 0) {
      setPageTitle(parts.join(' - ') + ' Products');
    } else {
      setPageTitle('All Products');
    }
  };
  
  // Update title when filters change
  useEffect(() => {
    if (initialized) {
      updatePageTitle();
    }
  }, [selectedCategories, selectedType, search, categoryTree, initialized]);

  // Update selected categories and search when URL changes
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const categoriesParam = searchParams.get('categories'); // CSV of category IDs (banners)
    const searchParam = searchParams.get('search');
    const typeParam = searchParams.get('type');
    const genderParam = searchParams.get('gender'); // banner alias for type
    const minPriceParam = searchParams.get('min_price');
    const maxPriceParam = searchParams.get('max_price');
    const discountOnlyParam = searchParams.get('discount_only');
    
    if (categoriesParam) {
      setSelectedCategories(categoriesParam.split(',').filter(Boolean));
    } else if (categoryParam) {
      setSelectedCategories([categoryParam]);
    } else {
      setSelectedCategories([]);
    }
    
    if (searchParam) setSearch(searchParam);
    else setSearch('');
    
    const t = typeParam || genderParam;
    if (t && ['men', 'women', 'kids'].includes(t)) {
      setSelectedType(t);
    } else {
      setSelectedType('all');
    }
    
    // Apply price filters from URL (banner deep links)
    const mn = minPriceParam ? parseFloat(minPriceParam) : null;
    const mx = maxPriceParam ? parseFloat(maxPriceParam) : null;
    if (mn != null || mx != null) {
      setPriceRange([
        Number.isFinite(mn) ? mn : 0,
        Number.isFinite(mx) ? mx : MAX_PRICE,
      ]);
    }
    
    if (discountOnlyParam === 'true' || discountOnlyParam === '1') {
      setDiscountRange((prev) => [Math.max(prev[0], 1), prev[1]]);
    }
    
    setInitialized(true);
  }, [searchParams]);

  useEffect(() => {
    fetchCategories();
    fetchWishlist();
  }, []);

  // Only fetch products after URL params have been processed - use debounced values
  useEffect(() => {
    if (initialized) {
      // Reset pagination on filter change
      setProducts([]);
      setCurrentPage(1);
      setHasMore(true);
      fetchProducts(1, true);
    }
  }, [initialized, selectedCategories, selectedType, debouncedPriceRange, debouncedDiscountRange, debouncedSearch, sortBy, selectedColors, selectedSizes, selectedShapes]);

  // Track user activity for recommendation engine
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.trim().length < 2) return;
    try {
      const searches = JSON.parse(localStorage.getItem('search_history') || '[]');
      const q = debouncedSearch.trim();
      const filtered = searches.filter(s => (typeof s === 'string' ? s : s.q) !== q);
      filtered.unshift({ q, ts: Date.now() });
      localStorage.setItem('search_history', JSON.stringify(filtered.slice(0, 50)));
    } catch (e) {}
  }, [debouncedSearch]);

  useEffect(() => {
    if (!selectedCategories || selectedCategories.length === 0) return;
    try {
      const cats = JSON.parse(localStorage.getItem('viewed_categories') || '[]');
      const updated = [...selectedCategories, ...cats];
      localStorage.setItem('viewed_categories', JSON.stringify(updated.slice(0, 100)));
    } catch (e) {}
  }, [selectedCategories]);

  // Load more pages
  useEffect(() => {
    if (currentPage > 1 && initialized) {
      fetchProducts(currentPage, false);
    }
  }, [currentPage]);

  const fetchCategories = async () => {
    try {
      // Fetch tree structure with only active categories
      const { data } = await api.categories.getTree(true);
      setCategoryTree(data);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const fetchWishlist = async () => {
    try {
      const { data } = await api.wishlist.get();
      setWishlistIds(data.products?.map(p => p.id) || []);
    } catch (error) {
      console.error('Failed to fetch wishlist', error);
    }
  };

  const fetchProducts = async (page = 1, isReset = false) => {
    if (isReset) setProductsLoading(true);
    else setLoadingMore(true);
    try {
      // Map frontend sort keys to backend sort_by parameter
      const sortMapping = {
        'newest': 'newest',
        'price_asc': 'price_asc',
        'price_desc': 'price_desc',
        'name_asc': 'name_asc',
        'popular': 'popular',
        'discount': 'discount',
      };
      const backendSort = sortMapping[sortBy];

      const params = {
        is_active: true,
        page,
        limit: PRODUCTS_PER_PAGE,
        ...(selectedCategories.length > 0 && { category_ids: selectedCategories.join(',') }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(debouncedPriceRange[0] > 0 && { min_price: debouncedPriceRange[0] }),
        ...(debouncedPriceRange[1] < MAX_PRICE && { max_price: debouncedPriceRange[1] }),
        ...(debouncedDiscountRange[0] > 0 && { min_discount: debouncedDiscountRange[0] }),
        ...(debouncedDiscountRange[1] < MAX_DISCOUNT && { max_discount: debouncedDiscountRange[1] }),
        ...(selectedType !== 'all' && { type: selectedType }),
        ...(backendSort && { sort_by: backendSort }),
        ...(selectedColors.length > 0 && { colors: selectedColors.join(',') }),
        ...(selectedSizes.length > 0 && { sizes: selectedSizes.join(',') }),
        ...(selectedShapes.length > 0 && { shapes: selectedShapes.join(',') }),
      };
      const { data } = await api.products.getAll(params);
      // Backend returns paginated response: { products, total, has_more }
      const newProducts = data.products || data;
      const total = data.total ?? (Array.isArray(data) ? data.length : 0);
      const hasMoreData = data.has_more ?? false;
      
      // Fetch boosted products only on first page (keep them separate)
      if (page === 1) {
        try {
          const boostRes = await api.promotions.getActive({ limit: 40 });
          const boosted = boostRes.data?.products || [];
          setBoostedProducts(boosted);
        } catch (e) {
          setBoostedProducts([]);
        }
      }
      
      if (isReset) {
        setProducts(newProducts);
      } else {
        // Backend already returns sorted results - just append in order
        setProducts(prev => [...prev, ...newProducts]);
      }
      setTotalProducts(total);
      setHasMore(hasMoreData);
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setProductsLoading(false);
      setLoadingMore(false);
    }
  };

  // Helper: compute recommendation score for a single product (stable, deterministic)
  const computeRecommendationScores = useCallback(() => {
    let viewedIds = new Set();
    let viewedCategories = new Map();
    let viewedShops = new Map();
    let clickedIds = new Map();
    let searches = [];
    try {
      const history = JSON.parse(localStorage.getItem('viewed_products') || '[]');
      history.forEach(id => viewedIds.add(id));
      const categoryHistory = JSON.parse(localStorage.getItem('viewed_categories') || '[]');
      categoryHistory.forEach(cid => viewedCategories.set(cid, (viewedCategories.get(cid) || 0) + 1));
      const shopHistory = JSON.parse(localStorage.getItem('viewed_shops') || '[]');
      shopHistory.forEach(sid => viewedShops.set(sid, (viewedShops.get(sid) || 0) + 1));
      const clickHistory = JSON.parse(localStorage.getItem('clicked_products') || '{}');
      Object.entries(clickHistory).forEach(([pid, cnt]) => clickedIds.set(pid, cnt));
      searches = JSON.parse(localStorage.getItem('search_history') || '[]').slice(0, 30);
    } catch (e) {}

    const searchKeywords = searches
      .map(s => (typeof s === 'string' ? s : s.q || '').toLowerCase().trim())
      .filter(s => s.length >= 2);

    return (p) => {
      let score = 0;
      if (viewedIds.has(p.id)) score += 60;
      const clickCnt = clickedIds.get(p.id) || 0;
      score += clickCnt * 15;
      const pCats = new Set([p.category_id, ...(p.category_ids || [])].filter(Boolean));
      pCats.forEach(cid => { score += (viewedCategories.get(cid) || 0) * 8; });
      if (p.shop_id && viewedShops.has(p.shop_id)) score += (viewedShops.get(p.shop_id) || 0) * 5;
      const hay = `${p.name || ''} ${p.description || ''}`.toLowerCase();
      searchKeywords.forEach(kw => { if (hay.includes(kw)) score += 12; });
      score += (p.view_count || 0) * 0.25;
      score += (p.average_rating || 0) * 15;
      score += (p.review_count || 0) * 1.5;
      if (p.discount_price && p.discount_price < p.price) score += 8;
      if ((p.stock || 0) > 0) score += 3;
      return score;
    };
  }, []);

  // Memoize score map to keep positions stable during pagination
  const scoreMapRef = useRef(new Map());
  
  const sortProducts = useCallback((productsToSort, sortMode) => {
    let sorted = [...productsToSort];
    switch (sortMode) {
      case 'recommended': {
        const scorer = computeRecommendationScores();
        // Compute scores only for products not already scored
        sorted.forEach(p => {
          if (!scoreMapRef.current.has(p.id)) {
            scoreMapRef.current.set(p.id, scorer(p));
          }
        });
        sorted.sort((a, b) => {
          const scoreA = scoreMapRef.current.get(a.id) || 0;
          const scoreB = scoreMapRef.current.get(b.id) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          // Stable tiebreak by id
          return (a.id || '').localeCompare(b.id || '');
        });
        break;
      }
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      case 'price_asc':
        sorted.sort((a, b) => (a.discount_price || a.price) - (b.discount_price || b.price));
        break;
      case 'price_desc':
        sorted.sort((a, b) => (b.discount_price || b.price) - (a.discount_price || a.price));
        break;
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'popular':
        sorted.sort((a, b) => {
          const scoreA = (a.view_count || 0) * 1 + (a.average_rating || 0) * 20 + (a.review_count || 0) * 5;
          const scoreB = (b.view_count || 0) * 1 + (b.average_rating || 0) * 20 + (b.review_count || 0) * 5;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (a.id || '').localeCompare(b.id || '');
        });
        break;
      case 'discount':
        sorted.sort((a, b) => {
          const da = a.discount_price ? Math.round(((a.price - a.discount_price) / a.price) * 100) : 0;
          const db = b.discount_price ? Math.round(((b.price - b.discount_price) / b.price) * 100) : 0;
          return db - da;
        });
        break;
      default:
        break;
    }
    return sorted;
  }, [computeRecommendationScores]);

  // Auto-sort products when sortBy changes OR on initial load
  // Backend handles sorting for: newest, price_asc, price_desc, name_asc, popular, discount
  // Frontend handles: recommended (local scoring)
  const lastSortRef = useRef(sortBy);
  const lastProductCountRef = useRef(0);
  const sortedSnapshotRef = useRef([]);
  useEffect(() => {
    const sortChanged = lastSortRef.current !== sortBy;
    lastSortRef.current = sortBy;
    
    // Clear score cache when sort mode changes
    if (sortChanged) {
      scoreMapRef.current = new Map();
      sortedSnapshotRef.current = [];
    }
    
    const prevCount = lastProductCountRef.current;
    lastProductCountRef.current = products.length;
    
    // For 'recommended', handle incremental appending to avoid reshuffling
    if (sortBy === 'recommended') {
      if (sortChanged || prevCount === 0 || products.length <= prevCount) {
        // Full re-sort on sort change or initial load or filter reset
        const sorted = sortProducts(products, sortBy);
        sortedSnapshotRef.current = sorted;
        setSortedProducts(sorted);
      } else {
        // Incremental: new products appended — only sort the new ones and append
        const existingIds = new Set(sortedSnapshotRef.current.map(p => p.id));
        const newProducts = products.filter(p => !existingIds.has(p.id));
        if (newProducts.length > 0) {
          const sortedNew = sortProducts(newProducts, sortBy);
          const merged = [...sortedSnapshotRef.current, ...sortedNew];
          sortedSnapshotRef.current = merged;
          setSortedProducts(merged);
        }
      }
    } else {
      // Backend already sorted these - just use the order as-is
      sortedSnapshotRef.current = [...products];
      setSortedProducts([...products]);
    }
  }, [products, sortBy, sortProducts]);

  // Infinite scroll observer
  const observerRef = useRef(null);
  const sentinelCallback = useCallback((node) => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !productsLoading && !loadingMore) {
        setCurrentPage(prev => prev + 1);
      }
    }, { threshold: 0.1, rootMargin: '300px' });
    if (node) observerRef.current.observe(node);
  }, [hasMore, productsLoading, loadingMore]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    // Debounce: only trigger API call after 400ms of no typing
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };
  const handlePriceChange = (value) => {
    setPriceRange(value);
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    priceDebounceRef.current = setTimeout(() => {
      setDebouncedPriceRange(value);
    }, 300);
  };
  
  const handleDiscountChange = (value) => {
    setDiscountRange(value);
    if (discountDebounceRef.current) clearTimeout(discountDebounceRef.current);
    discountDebounceRef.current = setTimeout(() => {
      setDebouncedDiscountRange(value);
    }, 300);
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedType('all');
    setPriceRange([0, MAX_PRICE]);
    setDiscountRange([0, MAX_DISCOUNT]);
    setDebouncedPriceRange([0, MAX_PRICE]);
    setDebouncedDiscountRange([0, MAX_DISCOUNT]);
    setSelectedColors([]);
    setSelectedSizes([]);
    setSelectedShapes([]);
    setSearch('');
    setDebouncedSearch('');
    setSortBy('newest');
  };

  const toggleColor = (name) => setSelectedColors(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleSize = (name) => setSelectedSizes(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleShape = (name) => setSelectedShapes(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const clearVariants = () => { setSelectedColors([]); setSelectedSizes([]); setSelectedShapes([]); };

  // Sponsored "Sponsored picks" carousels are inserted BETWEEN blocks of organic
  // products. Block size + number of cards per carousel depend on the device tier
  // (phone: 8/4, tablet: 9/5, laptop: 10/6). A carousel is only shown when MORE
  // products than the tier threshold are loaded AND sponsored products exist.
  const adsEnabledOnProducts = sponsoredEnabledFor('products');
  const showSponsoredCarousels =
    adsEnabledOnProducts && boostedProducts.length > 0 && sortedProducts.length > carouselThreshold;

  // Split sorted products into fixed-size blocks for block-based rendering.
  const productBlocks = React.useMemo(() => {
    const blocks = [];
    for (let i = 0; i < sortedProducts.length; i += blockSize) {
      blocks.push(sortedProducts.slice(i, i + blockSize));
    }
    return blocks;
  }, [sortedProducts, blockSize]);

  // Assign each eligible (full) block position a UNIQUE, NON-OVERLAPPING slice of
  // sponsored products so carousels NEVER repeat the same items. Once all sponsored
  // products have been used up, no further "Sponsored picks" carousels are shown.
  const sponsoredSlices = React.useMemo(() => {
    const slices = {};
    if (!showSponsoredCarousels) return slices;
    let offset = 0;
    for (let b = 0; b < productBlocks.length; b++) {
      if (productBlocks[b].length !== blockSize) continue; // only after FULL blocks
      if (offset >= boostedProducts.length) break;          // no different products left
      const slice = boostedProducts.slice(offset, offset + cardsPerCarousel);
      if (slice.length === 0) break;
      slices[b] = slice;
      offset += cardsPerCarousel;
    }
    return slices;
  }, [showSponsoredCarousels, productBlocks, blockSize, boostedProducts, cardsPerCarousel]);

  // How many sponsored products were already consumed by the in-between carousels.
  const sponsoredUsedCount = React.useMemo(
    () => Object.values(sponsoredSlices).reduce((sum, arr) => sum + arr.length, 0),
    [sponsoredSlices]
  );

  // Remaining sponsored products NOT shown in any carousel. When the organic
  // products end (no more pages) we render these below so no sponsored item is missed.
  const leftoverSponsored = React.useMemo(() => {
    if (!adsEnabledOnProducts || boostedProducts.length === 0) return [];
    return boostedProducts.slice(sponsoredUsedCount);
  }, [adsEnabledOnProducts, boostedProducts, sponsoredUsedCount]);

  // Family-category ids for the currently selected category (whole tree).
  const familyCategoryIds = React.useMemo(
    () => (selectedCategories.length === 1 ? getFamilyCategoryIds(categoryTree, selectedCategories[0]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCategories, categoryTree]
  );

  // Filter content JSX - rendered inline to avoid focus loss issue
  const filtersContentJSX = (
    <div className="space-y-5">
      {/* Type */}
      <div>
        <Label className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-2.5 block">{t('products.style')}</Label>
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-2">
          {[
            { value: 'all', label: t('products.all'), dot: 'bg-violet-500', text: 'text-violet-700', ring: 'peer-checked:ring-violet-300', check: 'peer-checked:bg-violet-600 peer-checked:border-violet-600' },
            { value: 'men', label: t('nav.men'), dot: 'bg-blue-500', text: 'text-blue-700', ring: 'peer-checked:ring-blue-300', check: 'peer-checked:bg-blue-600 peer-checked:border-blue-600' },
            { value: 'women', label: t('nav.women'), dot: 'bg-pink-500', text: 'text-pink-700', ring: 'peer-checked:ring-pink-300', check: 'peer-checked:bg-pink-600 peer-checked:border-pink-600' },
            { value: 'kids', label: t('nav.kids'), dot: 'bg-amber-500', text: 'text-amber-700', ring: 'peer-checked:ring-amber-300', check: 'peer-checked:bg-amber-500 peer-checked:border-amber-500' },
          ].map((type) => {
            const checked = selectedType === type.value;
            return (
              <label
                key={type.value}
                className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-all duration-200 ${
                  checked ? 'bg-slate-50 border-slate-300 shadow-sm' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                }`}
                data-testid={`type-filter-${type.value}`}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={() => setSelectedType(checked && type.value !== 'all' ? 'all' : type.value)}
                />
                <span className={`relative w-5 h-5 rounded-md border-2 border-slate-300 flex items-center justify-center transition-all ${type.check} peer-focus-visible:ring-2 ${type.ring}`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
                <span className={`inline-flex items-center gap-2 text-sm font-semibold ${checked ? type.text : 'text-slate-700'}`}>
                  <span className={`w-2 h-2 rounded-full ${type.dot}`} />
                  {type.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Categories - Advanced Collapsible Tree */}
      <div>
        <Label className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-2.5 block">{t('products.categories')}</Label>
        <CategoryTreeFilter
          categoryTree={categoryTree}
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
        />
      </div>

      {/* {t('products.priceRange')} Slider */}
      <div>
        <Label className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-2.5 block">{t('products.priceRange')}</Label>
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-3 border border-violet-100">
          <Slider
            value={priceRange}
            onValueChange={handlePriceChange}
            max={MAX_PRICE}
            min={0}
            step={10}
            className="mb-2"
            data-testid="price-range-slider"
          />
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-violet-600">${priceRange[0].toLocaleString()}</span>
            <span className="text-violet-600">${priceRange[1] === MAX_PRICE ? `${MAX_PRICE.toLocaleString()}+` : priceRange[1].toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      {/* Discount Range Slider */}
      <div>
        <Label className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-2.5 block">{ t('products.discount')}</Label>
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-3 border border-orange-100">
          <Slider
            value={discountRange}
            onValueChange={handleDiscountChange}
            max={MAX_DISCOUNT}
            min={0}
            step={5}
            className="mb-2"
            data-testid="discount-range-slider"
          />
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-orange-600">{discountRange[0]}% off</span>
            <span className="text-orange-600">{discountRange[1]}% off</span>
          </div>
        </div>
      </div>

      {/* Creative Variant Filters: Colors, Sizes, Shapes */}
      <VariantFilters
        selectedColors={selectedColors}
        selectedSizes={selectedSizes}
        selectedShapes={selectedShapes}
        onColorToggle={toggleColor}
        onSizeToggle={toggleSize}
        onShapeToggle={toggleShape}
        onClearAll={clearVariants}
        filterParams={{
          category_ids: selectedCategories,
          type: selectedType,
        }}
      />

      {/* Clear button */}
      <div className="pt-1">
        <Button
          onClick={clearFilters}
          variant="outline"
          className="w-full rounded-xl text-xs h-9 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          data-testid="clear-filters-button"
        >
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear All Filters
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-4 pb-8 sm:pt-6 sm:pb-12">
      <div className="max-w-[1600px] mx-auto px-0 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6 px-3 sm:px-0">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold" data-testid="products-page-title">
              <span className="bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-600 bg-clip-text text-transparent">{pageTitle}</span>
            </h1>
            <div className="h-1 w-16 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full mt-2" />
          </div>
          
          {/* Mobile filter button - hidden, replaced by FAB */}
          <div className="lg:hidden" />
        </div>

        {/* Category (Level 1) cards when browsing ALL products (no category selected) */}
        {selectedCategories.length === 0 && (
          <CategoryCards />
        )}

        {/* Sub-category breadcrumb cards (when filtering by a single category) */}
        {selectedCategories.length === 1 && (
          <SubCategoryCards activeCategoryId={selectedCategories[0]} />
        )}

        {/* Category landing sponsored band: "Featured in {Category}" — whole family tree */}
        {selectedCategories.length === 1 && (
          <div className="mb-6 px-3 sm:px-0">
            <SponsoredRow
              surface="category_band"
              title={`Featured in ${findCategoryName(categoryTree, selectedCategories[0]) || 'this Category'}`}
              subtitle="Sponsored picks across this category family"
              categoryIds={familyCategoryIds}
              variant="carousel"
              limit={12}
              data-testid="sponsored-category-band"
            />
          </div>
        )}

        {/* Search + Sorting + Count in one row */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-3 sm:px-0">
          <div className="flex-1 max-w-2xl">
            {/* Same AI search bar + dropdown as the home page */}
            <AISmartSearch />
          </div>
          <div className="flex items-center gap-3 sm:ml-auto">
            <p className="text-sm text-slate-600 whitespace-nowrap"><span className="font-semibold text-slate-800">{totalProducts || sortedProducts.length}</span> products</p>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200 w-44" data-testid="sort-select">
                  <SelectValue placeholder="Newest" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="name_asc">Name: A-Z</SelectItem>
                  <SelectItem value="discount">Biggest Discount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex gap-4 lg:gap-6">
          {/* Desktop Sidebar Filters */}
          <div className="hidden lg:block w-56 xl:w-64 flex-shrink-0">
            <div 
              ref={filtersSidebarRef} 
              className="sticky top-[96px]"
              style={{ maxHeight: 'calc(100vh - 110px)' }}
              data-testid="desktop-filters"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-y-auto scrollbar-creative" style={{ maxHeight: 'calc(100vh - 110px)' }}>
                <div className="flex items-center gap-2 p-4 pb-3 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h2 className="font-bold text-sm text-slate-900">{ t("products.filters")}</h2>
                </div>
                <div className="p-4 pt-3">
                  {filtersContentJSX}
                </div>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 min-w-0">
            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0">
                <ProductCardSkeleton count={10} />
              </div>
            ) : (
              <>
                {sortedProducts.length > 0 && (
                  <>
                    {/* Block-based grid: organic products in blocks with a
                        "Sponsored picks" carousel inserted after each full block. */}
                    {productBlocks.map((block, bIdx) => {
                      const picks = sponsoredSlices[bIdx] || [];
                      const showCarouselAfter = picks.length > 0;
                      return (
                        <React.Fragment key={`block-${bIdx}`}>
                          <div
                            className={`${bIdx === 0 ? '' : 'mt-3 sm:mt-4'} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 mobile-products-grid`}
                            data-testid={bIdx === 0 ? 'products-grid' : `products-grid-block-${bIdx}`}
                          >
                            {block.map((product) => (
                              <ProductCard key={product.id} product={product} wishlistIds={wishlistIds} />
                            ))}
                          </div>

                          {showCarouselAfter && (
                            <div className="my-2 sm:my-3 px-3 sm:px-0" data-testid={`sponsored-picks-${bIdx}`}>
                              <SponsoredRow
                                surface="products"
                                title="Sponsored picks"
                                subtitle=""
                                variant="carousel"
                                products={picks}
                                limit={cardsPerCarousel}
                                compact={true}
                                data-testid={`sponsored-picks-row-${bIdx}`}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Loading more skeleton */}
                    {loadingMore && (
                      <div className="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 mobile-products-grid">
                        <ProductCardSkeleton count={4} />
                      </div>
                    )}

                    {/* Infinite scroll sentinel */}
                    {hasMore && !loadingMore && (
                      <div ref={sentinelCallback} className="h-4" />
                    )}

                    {/* End of list message */}
                    {!hasMore && (
                      <EndOfListMessage total={totalProducts || sortedProducts.length} />
                    )}

                    {/* Remaining sponsored products below — only once organic products end
                        and there are sponsored items not yet shown in the carousels above. */}
                    {!hasMore && leftoverSponsored.length > 0 && (
                      <div className="mt-6" data-testid="sponsored-products-leftover">
                        <div className="mb-5 relative px-3 sm:px-0">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                              <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                More Sponsored Products
                              </h3>
                              <p className="text-xs text-slate-500">Promoted picks you may have missed</p>
                            </div>
                          </div>
                          <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-500 rounded-full hidden sm:block"></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 mobile-products-grid">
                          {leftoverSponsored.map((product) => (
                            <ProductCard key={`sponsored-leftover-${product.id}`} product={product} wishlistIds={wishlistIds} isSponsored={true} showShopName={true} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* No products found message + Sponsored Products Below */}
                {sortedProducts.length === 0 && !productsLoading && (
                  <div data-testid="no-products">
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                        <Search className="h-7 w-7 text-slate-400" />
                      </div>
                      <p className="text-slate-700 font-semibold text-base mb-1">{t("products.noProducts")}</p>
                      <p className="text-slate-500 text-sm">{t("products.tryAdjusting")}</p>
                    </div>
                    
                    {/* Show Sponsored Products when no results found */}
                    {adsEnabledOnProducts && boostedProducts.length > 0 && (
                      <div className="mt-6" data-testid="sponsored-products-no-results">
                        <div className="mb-5 relative">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                              <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                Sponsored Products
                              </h3>
                              <p className="text-xs text-slate-500">You might be interested in these</p>
                            </div>
                          </div>
                          <div className="absolute -left-2 top-0 w-1 h-full bg-gradient-to-b from-amber-400 to-orange-500 rounded-full"></div>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 mobile-products-grid">
                          {boostedProducts.map((product) => (
                            <ProductCard key={`sponsored-empty-${product.id}`} product={product} wishlistIds={wishlistIds} isSponsored={true} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile Filters Modal - Fixed RIGHT panel with body scroll lock */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
            <div className="fixed right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-50" onClick={e => e.stopPropagation()} data-testid="mobile-filter-panel">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <SlidersHorizontal className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="font-bold text-sm text-slate-900">{ t("products.filters")}</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="rounded-xl"
                  data-testid="close-mobile-filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-creative p-4">
                {filtersContentJSX}
              </div>
              <div className="p-4 border-t border-slate-100">
                <Button className="w-full rounded-full text-xs bg-violet-600 hover:bg-violet-700" onClick={() => setMobileFiltersOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Fixed Floating Filter Button on Mobile */}
        {!mobileFiltersOpen && (
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden mobile-filter-fab flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all active:scale-95"
            data-testid="mobile-filter-fab"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-xs font-semibold">Filters</span>
            {(selectedCategories.length > 0 || selectedType !== 'all' || debouncedPriceRange[0] > 0 || debouncedPriceRange[1] < 1000 || debouncedDiscountRange[0] > 0 || debouncedDiscountRange[1] < 100 || selectedColors.length > 0 || selectedSizes.length > 0 || selectedShapes.length > 0) && (
              <span className="w-5 h-5 bg-white text-violet-600 text-[10px] font-bold rounded-full flex items-center justify-center">
                {[selectedCategories.length > 0, selectedType !== 'all', debouncedPriceRange[0] > 0 || debouncedPriceRange[1] < 1000, debouncedDiscountRange[0] > 0 || debouncedDiscountRange[1] < 100, selectedColors.length > 0, selectedSizes.length > 0, selectedShapes.length > 0].filter(Boolean).length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
