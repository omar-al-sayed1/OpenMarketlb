import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, Megaphone, ArrowUpDown, Filter, SlidersHorizontal, Eye, Gift, Crown, Percent, Sparkles, Wand2, Tag, Palette, Ruler, Box, ImagePlus, DollarSign, Package, Check, ChevronRight, Loader2, Info, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiImageUploader from '../../components/MultiImageUploader';
import ImageUploader from '../../components/ImageUploader';
import BoostProductDialog from '../../components/BoostProductDialog';
import GiftDialog from '../../components/GiftDialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import CategoryTreeSelect from '../../components/CategoryTreeSelect';
import ProductFormDialog from '../../components/ProductFormDialog';

// Preset shape options
const SHAPE_OPTIONS = [
  'Round', 'Square', 'Rectangle', 'Oval', 'Heart', 'Star', 'Triangle',
  'Hexagon', 'Diamond', 'Cylinder', 'Cone', 'Sphere', 'Cube', 'Custom'
];

const SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Custom'];

const ShopProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesFlat, setCategoriesFlat] = useState([]);
  const [shopCategoryIds, setShopCategoryIds] = useState([]); // from shop profile - for suggestions
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
  const [boostProduct, setBoostProduct] = useState(null);
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftProductId, setGiftProductId] = useState(null);
  const [giftProductName, setGiftProductName] = useState('');
  const [shopTier, setShopTier] = useState('starter');
  const [productGifts, setProductGifts] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAccent, setAiAccent] = useState(false); // toggles a brief celebration
  // 4 variant global toggles (controlled by admin in /admin/settings)
  const [variantToggles, setVariantToggles] = useState({
    variant_color_enabled: true,
    variant_size_enabled: true,
    variant_shape_enabled: true,
    variant_type_enabled: true,
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_ids: [],
    gender: 'none',
    price: '',
    discount_price: '',
    stock: '',
    images: [''],
    colors: [],
    sizes: [],
    shapes: [],
    types: [],
    is_active: true,
    has_color_variants: false,
    has_size_variants: false,
    has_shape_variants: false,
    has_type_variants: false,
    use_same_price_colors: false,
    use_same_price_sizes: false,
    use_same_price_shapes: false,
    use_same_price_types: false,
    color_shared_price: '',
    color_shared_discount: '',
    size_shared_price: '',
    size_shared_discount: '',
    shape_shared_price: '',
    shape_shared_discount: '',
    type_shared_price: '',
    type_shared_discount: '',
    use_same_photo_sizes: false,
    size_variant_image: '',
    use_same_photo_types: false,
    type_variant_image: '',
    variant_selection_mode: 'single',
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCommissionRate();
    fetchTierAndGifts();
    fetchShopProfile();
    fetchVariantToggles();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products, sortBy, stockFilter, statusFilter, categoryFilter, priceMin, priceMax]);

  const filterProducts = () => {
    let filtered = [...products];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(p => (p.category_ids || []).includes(categoryFilter) || p.category_id === categoryFilter);
    }
    if (priceMin !== '' && !isNaN(parseFloat(priceMin))) {
      filtered = filtered.filter(p => (p.customer_price || p.price || 0) >= parseFloat(priceMin));
    }
    if (priceMax !== '' && !isNaN(parseFloat(priceMax))) {
      filtered = filtered.filter(p => (p.customer_price || p.price || 0) <= parseFloat(priceMax));
    }
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
      case 'newest':
      default: filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
    }
    setFilteredProducts(filtered);
  };

  const productStats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.is_active).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStock = products.filter(p => (p.stock || 0) === 0).length;
    return { total, active, lowStock, outOfStock };
  }, [products]);

  const activeFilterCount = [
    categoryFilter !== 'all', stockFilter !== 'all', statusFilter !== 'all',
    priceMin !== '', priceMax !== '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setCategoryFilter('all'); setStockFilter('all'); setStatusFilter('all'); setPriceMin(''); setPriceMax('');
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.shop.getProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getTree();
      setCategories(data);
      // Build flat list for label lookups
      const flat = [];
      const walk = (nodes) => {
        (nodes || []).forEach(n => { flat.push({ id: n.id, name: n.name }); if (n.children) walk(n.children); });
      };
      walk(data);
      setCategoriesFlat(flat);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const fetchShopProfile = async () => {
    try {
      const { data } = await api.shop.getProfile();
      setShopCategoryIds(data?.category_ids || []);
    } catch {}
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
      if (profileData?.commission_percentage !== null && profileData?.commission_percentage !== undefined) {
        setCommissionRate(profileData.commission_percentage);
      }
      if (profileData?.commission_type) {
        setCommissionType(profileData.commission_type);
      }
      if (profileData?.commission_percentage === null || profileData?.commission_percentage === undefined) {
        const { data: tierData } = await api.shopTier.getInfo();
        if (tierData?.commission_rate) setCommissionRate(tierData.commission_rate);
      }
    } catch (error) {
      try {
        const { data } = await api.admin.getPlatformSettings();
        setCommissionRate(data.commission_percentage || 10);
      } catch {}
    }
  };

  const fetchTierAndGifts = async () => {
    try {
      const [tierRes, giftsRes] = await Promise.allSettled([
        api.shopTier.getInfo(),
        api.shopGifts.getAll()
      ]);
      if (tierRes.status === 'fulfilled') setShopTier(tierRes.value.data?.current_tier || 'starter');
      if (giftsRes.status === 'fulfilled') {
        const gifts = giftsRes.value.data?.gifts || [];
        const gMap = {};
        gifts.forEach(g => { gMap[g.product_id] = g; });
        setProductGifts(gMap);
      }
    } catch (e) { /* silent */ }
  };

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

  // Suggested categories — intersection with shop's preferred categories from profile
  const suggestedCategoryObjects = useMemo(() => {
    if (!shopCategoryIds || shopCategoryIds.length === 0) return [];
    return shopCategoryIds
      .map(id => categoriesFlat.find(c => c.id === id))
      .filter(Boolean);
  }, [shopCategoryIds, categoriesFlat]);

  const toggleCategoryQuick = (catId) => {
    setFormData(prev => ({
      ...prev,
      category_ids: prev.category_ids.includes(catId)
        ? prev.category_ids.filter(id => id !== catId)
        : [...prev.category_ids, catId]
    }));
  };

  const handleAiGenerate = async () => {
    if (!formData.name?.trim() && (!formData.images || !formData.images.filter(Boolean).length)) {
      toast.error('Add a product name or upload an image first, then let AI fill the rest!');
      return;
    }
    setAiLoading(true);
    try {
      const firstImage = (formData.images || []).find(u => u && u.trim());
      const { data } = await api.shop.aiGenerateProduct({
        name: formData.name,
        image_url: firstImage,
        description: formData.description,
      });
      // Merge AI suggestions intelligently
      const updates = {};
      if (data.description) updates.description = data.description;
      if (Array.isArray(data.category_ids) && data.category_ids.length > 0) {
        // merge with existing selections (dedupe)
        const merged = [...new Set([...(formData.category_ids || []), ...data.category_ids])];
        updates.category_ids = merged;
      }
      if (data.type && data.type !== 'none') updates.gender = data.type;
      setFormData(prev => ({ ...prev, ...updates }));
      // Visual feedback
      setAiAccent(true);
      setTimeout(() => setAiAccent(false), 1500);
      const variantHints = (data.suggested_variants || []).join(', ');
      toast.success(`AI filled the details${variantHints ? ` · suggested variants: ${variantHints}` : ''}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const hasAnyVariants = formData.has_color_variants || formData.has_size_variants || formData.has_shape_variants || formData.has_type_variants;
      const validColors = formData.colors.filter(c => c.color_name && c.image_url);
      const validSizes = formData.sizes.filter(s => s.size_name);
      const validShapes = formData.shapes.filter(s => s.shape_name && s.image_url);
      const validTypes = formData.types.filter(t => t.type_name);

      let totalStock = 0;
      if (hasAnyVariants) {
        totalStock += validColors.reduce((sum, c) => sum + (parseInt(c.stock) || 0), 0);
        totalStock += validSizes.reduce((sum, s) => sum + (parseInt(s.stock) || 0), 0);
        totalStock += validShapes.reduce((sum, s) => sum + (parseInt(s.stock) || 0), 0);
        totalStock += validTypes.reduce((sum, t) => sum + (parseInt(t.stock) || 0), 0);
      } else {
        totalStock = parseInt(formData.stock);
      }

      let processedColors = validColors;
      let processedSizes = validSizes;
      let processedShapes = validShapes;
      let processedTypes = validTypes;
      if (formData.use_same_price_colors && formData.has_color_variants) {
        const bp = parseFloat(formData.color_shared_price) || 0;
        const bd = formData.color_shared_discount ? parseFloat(formData.color_shared_discount) : null;
        processedColors = validColors.map(c => ({ ...c, price: bp, discount_price: bd }));
      }
      if (formData.use_same_price_sizes && formData.has_size_variants) {
        const bp = parseFloat(formData.size_shared_price) || 0;
        const bd = formData.size_shared_discount ? parseFloat(formData.size_shared_discount) : null;
        processedSizes = validSizes.map(s => ({ ...s, price: bp, discount_price: bd }));
      }
      if (formData.use_same_price_shapes && formData.has_shape_variants) {
        const bp = parseFloat(formData.shape_shared_price) || 0;
        const bd = formData.shape_shared_discount ? parseFloat(formData.shape_shared_discount) : null;
        processedShapes = validShapes.map(s => ({ ...s, price: bp, discount_price: bd }));
      }
      if (formData.use_same_price_types && formData.has_type_variants) {
        const bp = parseFloat(formData.type_shared_price) || 0;
        const bd = formData.type_shared_discount ? parseFloat(formData.type_shared_discount) : null;
        processedTypes = validTypes.map(t => ({ ...t, price: bp, discount_price: bd }));
      }

      const basePrice = hasAnyVariants
        ? (processedColors[0]?.price || processedSizes[0]?.price || processedShapes[0]?.price || processedTypes[0]?.price || parseFloat(formData.price) || 0)
        : parseFloat(formData.price);
      const baseDiscount = hasAnyVariants
        ? (processedColors[0]?.discount_price || processedSizes[0]?.discount_price || processedShapes[0]?.discount_price || processedTypes[0]?.discount_price || (formData.discount_price ? parseFloat(formData.discount_price) : undefined))
        : (formData.discount_price ? parseFloat(formData.discount_price) : undefined);

      const payload = {
        name: formData.name,
        description: formData.description,
        category_ids: formData.category_ids,
        category_id: formData.category_ids[0] || null,
        type: formData.gender || 'none',
        price: basePrice,
        discount_price: baseDiscount,
        stock: totalStock,
        images: (() => {
          let imgs = formData.images.filter(url => url.trim() !== '');
          if (formData.has_color_variants && processedColors.length > 0 && processedColors[0].image_url) {
            const firstImg = processedColors[0].image_url;
            imgs = [firstImg, ...imgs.filter(img => img !== firstImg)];
          }
          return imgs;
        })(),
        colors: formData.has_color_variants ? processedColors : [],
        sizes: formData.has_size_variants ? processedSizes : [],
        shapes: formData.has_shape_variants ? processedShapes : [],
        types: formData.has_type_variants ? processedTypes : [],
        has_color_variants: formData.has_color_variants,
        has_size_variants: formData.has_size_variants,
        has_shape_variants: formData.has_shape_variants,
        has_type_variants: formData.has_type_variants,
        use_same_price: formData.use_same_price_colors || formData.use_same_price_sizes || formData.use_same_price_shapes || formData.use_same_price_types,
        use_same_photo_sizes: formData.use_same_photo_sizes,
        size_variant_image: formData.size_variant_image || null,
        use_same_photo_types: formData.use_same_photo_types,
        type_variant_image: formData.type_variant_image || null,
        variant_selection_mode: formData.variant_selection_mode || 'single',
        is_active: formData.is_active,
      };

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

  const handleEdit = (product) => {
    setEditingProduct(product);
    const originalPrice = product.original_price || product.price;
    const originalDiscount = product.original_discount_price || product.discount_price;

    setFormData({
      name: product.name,
      description: product.description,
      category_ids: product.category_ids || (product.category_id ? [product.category_id] : []),
      gender: product.gender || product.type || 'none',
      price: originalPrice.toString(),
      discount_price: originalDiscount ? originalDiscount.toString() : '',
      stock: (product.has_color_variants || product.has_size_variants || product.has_shape_variants || product.has_type_variants || (product.colors?.length > 0)) ? '' : product.stock.toString(),
      images: product.images.length > 0 ? product.images : [''],
      colors: product.colors || [],
      sizes: product.sizes || [],
      shapes: product.shapes || [],
      types: product.types || [],
      is_active: product.is_active,
      has_color_variants: product.has_color_variants || (product.colors?.length > 0),
      has_size_variants: product.has_size_variants || false,
      has_shape_variants: product.has_shape_variants || false,
      has_type_variants: product.has_type_variants || (product.types?.length > 0) || false,
      use_same_price_colors: product.use_same_price || false,
      use_same_price_sizes: product.use_same_price || false,
      use_same_price_shapes: product.use_same_price || false,
      use_same_price_types: product.use_same_price || false,
      color_shared_price: '', color_shared_discount: '',
      size_shared_price: '', size_shared_discount: '',
      shape_shared_price: '', shape_shared_discount: '',
      type_shared_price: '', type_shared_discount: '',
      use_same_photo_sizes: product.use_same_photo_sizes || false,
      size_variant_image: product.size_variant_image || '',
      use_same_photo_types: product.use_same_photo_types || false,
      type_variant_image: product.type_variant_image || '',
      variant_selection_mode: product.variant_selection_mode || 'single',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.shop.deleteProduct(id);
        toast.success('Product deleted');
        fetchProducts();
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '', description: '', category_ids: [], gender: 'none', price: '', discount_price: '', stock: '', images: [''],
      colors: [], sizes: [], shapes: [], types: [], is_active: true,
      has_color_variants: false, has_size_variants: false, has_shape_variants: false, has_type_variants: false,
      use_same_price_colors: false, use_same_price_sizes: false, use_same_price_shapes: false, use_same_price_types: false,
      color_shared_price: '', color_shared_discount: '', size_shared_price: '', size_shared_discount: '', shape_shared_price: '', shape_shared_discount: '', type_shared_price: '', type_shared_discount: '',
      use_same_photo_sizes: false, size_variant_image: '',
      use_same_photo_types: false, type_variant_image: '',
      variant_selection_mode: 'single',
    });
  };

  const handleCategoryChange = (selectedIds) => {
    setFormData({ ...formData, category_ids: selectedIds });
  };

  const enabledVariantCount = [formData.has_color_variants, formData.has_size_variants, formData.has_shape_variants, formData.has_type_variants].filter(Boolean).length;

  return (
    <ShopLayout>
      <div className="flex-1 overflow-y-auto p-1 sm:p-2 lg:p-4 shop-table-page compact-table" data-testid="shop-products-content">
        <h1 className="text-3xl lg:text-4xl font-heading font-bold mb-6 lg:mb-8" data-testid="shop-products-title">Products</h1>

        {/* Stats summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Products', value: productStats.total, icon: Package, grad: 'from-violet-500 to-fuchsia-500' },
            { label: 'Active', value: productStats.active, icon: CheckCircle2, grad: 'from-emerald-500 to-teal-500' },
            { label: 'Low Stock', value: productStats.lowStock, icon: AlertTriangle, grad: 'from-amber-500 to-orange-500' },
            { label: 'Out of Stock', value: productStats.outOfStock, icon: X, grad: 'from-rose-500 to-red-500' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-4 shadow-card"
              data-testid={`shop-product-stat-${i}`}
            >
              <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full bg-gradient-to-br ${s.grad} opacity-10`} />
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center mb-2 shadow-sm`}>
                <s.icon className="h-4 w-4 text-white" />
              </div>
              <div className="text-2xl font-black text-slate-800">{s.value}</div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus:border-violet-400 focus:ring-violet-400/20 text-sm"
                data-testid="search-products-input"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={resetForm}
                  className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 hover:from-violet-700 hover:via-fuchsia-700 hover:to-rose-600 text-white shadow-lg shadow-violet-500/25 w-full sm:w-auto rounded-xl"
                  data-testid="add-product-button"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <ProductFormDialog
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
            </Dialog>
          </div>

          {/* Sorting and Filters Row */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="font-medium">{filteredProducts.length} products</span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowFilters(v => !v)}
                  className={`h-8 text-xs rounded-lg gap-1.5 ${activeFilterCount > 0 ? 'border-violet-400 text-violet-700 bg-violet-50' : ''}`}
                  data-testid="shop-toggle-filters-button"
                >
                  <Filter className="h-3.5 w-3.5" /> Filters
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold">{activeFilterCount}</span>
                  )}
                </Button>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="h-8 text-xs w-32 rounded-lg"><SelectValue placeholder="Stock" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs w-28 rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-8 text-xs w-36 rounded-lg">
                    <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name_asc">Name A-Z</SelectItem>
                    <SelectItem value="name_desc">Name Z-A</SelectItem>
                    <SelectItem value="price_asc">Price Low-High</SelectItem>
                    <SelectItem value="price_desc">Price High-Low</SelectItem>
                    <SelectItem value="stock_asc">Stock Low-High</SelectItem>
                    <SelectItem value="stock_desc">Stock High-Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3"
                data-testid="shop-products-filters-panel"
              >
                <div>
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><Filter className="h-3 w-3" /> Category</Label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-9 w-full px-2 rounded-lg border border-slate-200 bg-white text-sm focus:border-violet-400"
                    data-testid="shop-products-category-filter"
                  >
                    <option value="all">All Categories</option>
                    {categoriesFlat.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Customer Price Range</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-9 rounded-lg" data-testid="shop-products-price-min" />
                    <span className="text-slate-400">–</span>
                    <Input type="number" min="0" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-9 rounded-lg" data-testid="shop-products-price-max" />
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetFilters} className="text-slate-500 hover:text-rose-600 whitespace-nowrap" data-testid="shop-clear-filters-button">
                        <X className="h-4 w-4 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Commission Info Banner */}
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-3 flex items-center gap-3 text-sm" data-testid="commission-info-banner">
          <div className="p-1.5 bg-violet-100 rounded-lg"><Percent className="h-4 w-4 text-violet-600" /></div>
          <div className="flex-1">
            <span className="font-semibold text-violet-900">Commission: {commissionRate}%</span>
            <span className="mx-2 text-violet-300">|</span>
            <span className="text-violet-700">
              {commissionType === 'on_shop' && 'Deducted from your revenue (customer sees listed price)'}
              {commissionType === 'on_customer' && 'Added to customer price (you receive full listed price)'}
              {commissionType === 'half_half' && 'Split: half from your revenue, half added to customer price'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Image</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Variants</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Your Price</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Customer Price</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Stock</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Views</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProducts.map((product) => {
                  const originalPrice = product.original_price || product.price;
                  const originalDiscount = product.original_discount_price || product.discount_price;
                  const customerPrice = product.customer_price || product.price;
                  const customerDiscount = product.customer_discount_price || product.discount_price;
                  const shopRevPrice = product.shop_revenue_price || originalPrice;
                  const shopRevDiscount = product.shop_revenue_discount_price || originalDiscount;
                  const commTypeLabel = product.commission_type;
                  const showRevHint = shopRevPrice !== originalPrice; // only different when on_shop / half_half
                  return (
                    <tr key={product.id} className="transition-colors hover:bg-violet-50/40">
                      <td className="px-6 py-4">
                        <div className="relative inline-block">
                          <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover rounded-lg ring-1 ring-slate-200 transition-transform hover:scale-105" />
                          {product.images && product.images.length > 1 && (
                            <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm" data-testid={`photo-count-${product.id}`}>
                              +{product.images.length - 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        <div>
                          {product.name}
                          {product.is_promoted && (
                            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">
                              <Megaphone className="w-3 h-3" /> Promoted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {product.has_color_variants && product.colors?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium" title={product.colors.map(c => c.color_name).join(', ')}>
                              {product.colors.length} Colors
                            </span>
                          )}
                          {product.has_size_variants && product.sizes?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium" title={product.sizes.map(s => s.size_name).join(', ')}>
                              {product.sizes.length} Sizes
                            </span>
                          )}
                          {product.has_shape_variants && product.shapes?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium" title={product.shapes.map(s => s.shape_name).join(', ')}>
                              {product.shapes.length} Shapes
                            </span>
                          )}
                          {product.has_type_variants && product.types?.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium" title={product.types.map(t => t.type_name).join(', ')}>
                              {product.types.length} Types
                            </span>
                          )}
                          {!product.has_color_variants && !product.has_size_variants && !product.has_shape_variants && !product.has_type_variants && (
                            <span className="text-[10px] text-slate-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5" data-testid={`your-price-${product.id}`}>
                          <div className="font-semibold text-slate-800">${originalPrice.toFixed(2)}</div>
                          {originalDiscount && (<div className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">Sale: ${originalDiscount.toFixed(2)}</div>)}
                          <div className="text-[10px] text-slate-400">As you entered</div>
                          {showRevHint && (
                            <div className="text-[10px] text-emerald-600 font-medium mt-1">
                              You receive: ${shopRevPrice.toFixed(2)}{shopRevDiscount ? ` / $${shopRevDiscount.toFixed(2)}` : ''}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-violet-600">${customerPrice.toFixed(2)}</div>
                          {customerDiscount && (<div className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded inline-block">Sale: ${customerDiscount.toFixed(2)}</div>)}
                          <div className="text-[10px] text-slate-400">What they see</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{product.stock}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm font-medium">{product.view_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setBoostProduct(product); setBoostDialogOpen(true); }} className="text-amber-500 hover:text-amber-600 hover:bg-amber-50" title="Boost Product" data-testid={`boost-btn-${product.id}`}>
                            <Megaphone className="h-4 w-4" />
                            <span className="ml-1 text-xs hidden sm:inline">Boost</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                              setGiftProductId(product.id); setGiftProductName(product.name); setGiftDialogOpen(true);
                            }}
                            className={`${productGifts[product.id] ? 'text-pink-600 bg-pink-50' : 'text-pink-400'} hover:text-pink-600 hover:bg-pink-50`}
                            title={productGifts[product.id] ? 'Edit Gift' : 'Add Gift'}
                            data-testid={`gift-btn-${product.id}`}
                          >
                            <Gift className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {product.is_promoted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full mt-1">
                            <Megaphone className="w-3 h-3" /> Boosted
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-slate-500">No products yet. Add your first product!</div>
          )}
        </div>
      </div>

      <BoostProductDialog open={boostDialogOpen} onClose={() => setBoostDialogOpen(false)} product={boostProduct} onSuccess={fetchProducts} />
      <GiftDialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen} productId={giftProductId} productName={giftProductName} onGiftSaved={() => { fetchProducts(); fetchTierAndGifts(); }} />
    </ShopLayout>
  );
};

export default ShopProducts;
