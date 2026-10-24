import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, Image as ImageIcon, ArrowUpDown, SlidersHorizontal, Package, DollarSign, AlertTriangle, CheckCircle2, Store, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '../../components/AdminLayout';
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
import { api } from '../../lib/api';
import { toast } from 'sonner';
import CategoryTreeSelect from '../../components/CategoryTreeSelect';
import ProductFormDialog from '../../components/ProductFormDialog';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shops, setShops] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformSettings, setPlatformSettings] = useState({ commission_percentage: 0, commission_enabled: false });
  const [variantToggles, setVariantToggles] = useState({
    variant_color_enabled: true,
    variant_size_enabled: true,
    variant_shape_enabled: true,
    variant_type_enabled: true,
  });
  const [commissionRate, setCommissionRate] = useState(10);
  const [commissionType, setCommissionType] = useState('on_customer'); // on_shop | on_customer | half_half
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest');
  const [shopFilter, setShopFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const ITEMS_PER_PAGE = 15;
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
    shop_id: '',
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchPlatformSettings();
    fetchShops();
  }, []);
  
  const fetchPlatformSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setPlatformSettings(data);
      setVariantToggles({
        variant_color_enabled: data?.variant_color_enabled !== false,
        variant_size_enabled: data?.variant_size_enabled !== false,
        variant_shape_enabled: data?.variant_shape_enabled !== false,
        variant_type_enabled: data?.variant_type_enabled !== false,
      });
      // Default commission rate (used when no shop selected)
      if (data?.commission_percentage) setCommissionRate(data.commission_percentage);
    } catch (error) {
      console.error('Failed to fetch platform settings', error);
    }
  };

  // When admin selects a shop in the product form, auto-update the commission_type and rate from that shop
  useEffect(() => {
    if (!formData.shop_id) return;
    const sel = shops.find(s => s.id === formData.shop_id);
    if (sel) {
      if (sel.commission_type) setCommissionType(sel.commission_type);
      if (sel.commission_percentage !== null && sel.commission_percentage !== undefined) {
        setCommissionRate(sel.commission_percentage);
      } else if (platformSettings.commission_percentage) {
        setCommissionRate(platformSettings.commission_percentage);
      }
    }
  }, [formData.shop_id, shops, platformSettings.commission_percentage]);

  const calculateCustomerPrice = (price) => {
    if (!price || isNaN(price)) return '0.00';
    const p = parseFloat(price);
    const rate = (commissionRate || 0) / 100;
    if (commissionType === 'on_shop') return p.toFixed(2);
    if (commissionType === 'half_half') return (p * (1 + rate / 2)).toFixed(2);
    return (p * (1 + rate)).toFixed(2);
  };

  const calculateShopRevenue = (price) => {
    if (!price || isNaN(price)) return '0.00';
    const p = parseFloat(price);
    const rate = (commissionRate || 0) / 100;
    if (commissionType === 'on_customer') return p.toFixed(2);
    if (commissionType === 'half_half') return (p * (1 - rate / 2)).toFixed(2);
    return (p * (1 - rate)).toFixed(2);
  };

  const getCommissionTypeLabel = () => {
    if (commissionType === 'on_shop') return 'On Shop';
    if (commissionType === 'half_half') return 'Half/Half';
    return 'On Customer';
  };

  useEffect(() => {
    filterProducts();
  }, [searchQuery, products, sortBy, shopFilter, categoryFilter, stockFilter, statusFilter, priceMin, priceMax]);

  // Flat list of categories for the category filter dropdown
  const flatCategories = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      (nodes || []).forEach(n => {
        out.push({ id: n.id, name: `${'— '.repeat(depth)}${n.name}` });
        if (n.children) walk(n.children, depth + 1);
      });
    };
    walk(categories);
    return out;
  }, [categories]);

  // Stats for the summary cards
  const productStats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.is_active).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStock = products.filter(p => (p.stock || 0) === 0).length;
    return { total, active, lowStock, outOfStock };
  }, [products]);

  const activeFilterCount = [
    shopFilter !== 'all',
    categoryFilter !== 'all',
    stockFilter !== 'all',
    statusFilter !== 'all',
    priceMin !== '',
    priceMax !== '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setShopFilter('all'); setCategoryFilter('all'); setStockFilter('all');
    setStatusFilter('all'); setPriceMin(''); setPriceMax('');
  };

  const filterProducts = () => {
    let filtered = [...products];
    if (shopFilter && shopFilter !== 'all') {
      filtered = filtered.filter(product => product.shop_id === shopFilter);
    }
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(product =>
        (product.category_ids || []).includes(categoryFilter) || product.category_id === categoryFilter
      );
    }
    if (stockFilter === 'in_stock') filtered = filtered.filter(p => (p.stock || 0) > 0);
    else if (stockFilter === 'low_stock') filtered = filtered.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 10);
    else if (stockFilter === 'out_of_stock') filtered = filtered.filter(p => (p.stock || 0) === 0);
    if (statusFilter === 'active') filtered = filtered.filter(p => p.is_active);
    else if (statusFilter === 'inactive') filtered = filtered.filter(p => !p.is_active);
    if (priceMin !== '' && !isNaN(parseFloat(priceMin))) {
      filtered = filtered.filter(p => (p.customer_price || p.price || 0) >= parseFloat(priceMin));
    }
    if (priceMax !== '' && !isNaN(parseFloat(priceMax))) {
      filtered = filtered.filter(p => (p.customer_price || p.price || 0) <= parseFloat(priceMax));
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.price.toString().includes(query) ||
        product.stock.toString().includes(query)
      );
    }
    // Sort
    switch (sortBy) {
      case 'newest': filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break;
      case 'oldest': filtered.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')); break;
      case 'price_asc': filtered.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price_desc': filtered.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'name_asc': filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'stock_low': filtered.sort((a, b) => (a.stock || 0) - (b.stock || 0)); break;
      case 'rating_desc': filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      default: break;
    }
    setFilteredProducts(filtered);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const fetchProducts = async () => {
    try {
      const { data } = await api.admin.getAllProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
      try {
        const { data } = await api.products.getAll({ is_active: undefined });
        setProducts(data);
        setFilteredProducts(data);
      } catch (e) {
        console.error('Fallback also failed', e);
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.categories.getTree();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  const fetchShops = async () => {
    try {
      const { data } = await api.admin.getShops();
      setShops(data);
    } catch (error) {
      console.error('Failed to fetch shops', error);
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

      let images = formData.images.filter(url => url.trim() !== '');
      if (formData.has_color_variants && validColors.length > 0 && validColors[0].image_url) {
        const firstImg = validColors[0].image_url;
        images = [firstImg, ...images.filter(img => img !== firstImg)];
      }

      // Apply per-variant same price logic
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

      // Use first variant price as product base price if variants enabled
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
        images,
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
        shop_id: formData.shop_id || undefined,
      };

      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
        toast.success('Product updated');
      } else {
        await api.products.create(payload);
        toast.success('Product created');
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      toast.error('Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name, description: product.description,
      category_ids: product.category_ids || (product.category_id ? [product.category_id] : []),
      gender: product.type || product.gender || 'none',
      price: product.price.toString(), discount_price: product.discount_price?.toString() || '',
      stock: (product.has_color_variants || product.has_size_variants || product.has_shape_variants || product.has_type_variants || (product.colors?.length > 0)) ? '' : product.stock.toString(),
      images: product.images.length > 0 ? product.images : [''],
      colors: product.colors || [], sizes: product.sizes || [], shapes: product.shapes || [], types: product.types || [],
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
      shop_id: product.shop_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.products.delete(id);
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
      shop_id: '',
    });
  };

  const handleCategoryChange = (newCategoryIds) => {
    setFormData(prev => ({
      ...prev,
      category_ids: newCategoryIds
    }));
  };

  const addColorVariant = () => {
    setFormData(prev => ({
      ...prev,
      colors: [...prev.colors, { color_name: '', color_code: '#000000', image_url: '' }]
    }));
  };

  const removeColorVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.filter((_, i) => i !== index)
    }));
  };

  const updateColorVariant = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      colors: prev.colors.map((c, i) => i === index ? { ...c, [field]: value } : c)
    }));
  };

  return (
    <AdminLayout>
      <div className="p-1 sm:p-2 lg:p-4 admin-table-page compact-table" data-testid="admin-products-content">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-heading font-bold" data-testid="admin-products-title">Products</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={resetForm}
                className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                data-testid="add-product-button"
              >
                <Plus className="h-4 w-4 mr-2" />
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
              shops={shops}
            />
          </Dialog>
        </div>

        {/* Stats summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Products', value: productStats.total, icon: Package, grad: 'from-violet-500 to-indigo-500' },
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
              data-testid={`product-stat-${i}`}
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

        {/* Search + Filters Bar */}
        <div className="mb-6 bg-white rounded-2xl p-4 shadow-card border border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search by product name, description, price, or stock..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
                data-testid="products-search-input"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(v => !v)}
              className={`rounded-xl gap-2 ${activeFilterCount > 0 ? 'border-violet-400 text-violet-700 bg-violet-50' : ''}`}
              data-testid="toggle-filters-button"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">{activeFilterCount}</span>
              )}
            </Button>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48 rounded-xl" data-testid="products-sort-select">
                <ArrowUpDown className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="stock_low">Stock: Low to High</SelectItem>
                <SelectItem value="rating_desc">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
              data-testid="products-filters-panel"
            >
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><Store className="h-3 w-3" /> Shop</Label>
                <Select value={shopFilter} onValueChange={setShopFilter}>
                  <SelectTrigger className="rounded-xl" data-testid="products-shop-filter"><SelectValue placeholder="All Shops" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shops</SelectItem>
                    {shops.map(shop => (<SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><Filter className="h-3 w-3" /> Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="rounded-xl" data-testid="products-category-filter"><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="all">All Categories</SelectItem>
                    {flatCategories.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><Package className="h-3 w-3" /> Availability</Label>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="rounded-xl" data-testid="products-stock-filter"><SelectValue placeholder="All Stock" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock (≤10)</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-xl" data-testid="products-status-filter"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <Label className="text-[11px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Customer Price Range</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="rounded-xl" data-testid="products-price-min" />
                  <span className="text-slate-400">–</span>
                  <Input type="number" min="0" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="rounded-xl" data-testid="products-price-max" />
                </div>
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-2">
                {activeFilterCount > 0 && (
                  <Button variant="ghost" onClick={resetFilters} className="text-slate-500 hover:text-rose-600 gap-1" data-testid="clear-filters-button">
                    <X className="h-4 w-4" /> Clear all filters
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>Showing {paginatedProducts.length} of {filteredProducts.length} products (total: {products.length})</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden" data-testid="products-table">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Image</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Categories</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Shop Price</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Customer Price</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Stock</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Variants</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedProducts.map((product) => {
                  const originalPrice = product.original_price || product.price;
                  const originalDiscount = product.original_discount_price || product.discount_price;
                  const customerPrice = product.customer_price || product.price;
                  const customerDiscount = product.customer_discount_price || product.discount_price;
                  
                  return (
                  <tr key={product.id} data-testid={`product-row-${product.id}`} className="transition-colors hover:bg-violet-50/40">
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover rounded-lg ring-1 ring-slate-200 transition-transform hover:scale-105" data-testid="product-table-image" />
                        {product.images.length > 1 && (
                          <span className="text-xs text-slate-500 self-end">+{product.images.length - 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium" data-testid="product-table-name">
                      <div>
                        {product.name}
                        {product.is_promoted && (
                          <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">
                            Promoted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(product.category_ids || []).map(catId => {
                          const findCat = (cats) => { for (const c of cats) { if (c.id === catId) return c; if (c.children) { const f = findCat(c.children); if (f) return f; } } return null; };
                          const cat = findCat(categories);
                          return cat ? <span key={catId} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{cat.name}</span> : null;
                        })}
                        {(!product.category_ids || product.category_ids.length === 0) && <span className="text-slate-400 text-xs">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-testid="product-table-price">
                      <div className="space-y-0.5">
                        <div className="font-semibold">${originalPrice.toFixed(2)}</div>
                        {originalDiscount && (
                          <div className="text-xs text-emerald-600">Sale: ${originalDiscount.toFixed(2)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-testid="product-table-customer-price">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-violet-600">${customerPrice.toFixed(2)}</div>
                        {customerDiscount && (
                          <div className="text-xs text-emerald-600">Sale: ${customerDiscount.toFixed(2)}</div>
                        )}
                        <div className="text-[10px] text-slate-400">+{product.commission_rate_percent || platformSettings.commission_percentage}% commission</div>
                        {product.shop_name && (
                          <div className="text-[10px] text-slate-400">{product.shop_name} ({product.shop_tier || 'starter'})</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-testid="product-table-stock">{product.stock}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {product.colors && product.colors.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-violet-600 font-medium">{product.colors.length} colors</span>
                            <div className="flex gap-0.5">
                              {product.colors.slice(0, 3).map((color, idx) => (
                                <div key={idx} className="w-4 h-4 rounded-full border border-slate-300"
                                  style={{ backgroundColor: color.color_code }} title={color.color_name} />
                              ))}
                              {product.colors.length > 3 && <span className="text-[10px] text-slate-400">+{product.colors.length - 3}</span>}
                            </div>
                          </div>
                        )}
                        {product.sizes && product.sizes.length > 0 && (
                          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">{product.sizes.length} sizes</span>
                        )}
                        {product.shapes && product.shapes.length > 0 && (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">{product.shapes.length} shapes</span>
                        )}
                        {product.types && product.types.length > 0 && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">{product.types.length} types</span>
                        )}
                        {(!product.colors || product.colors.length === 0) && (!product.sizes || product.sizes.length === 0) && (!product.shapes || product.shapes.length === 0) && (!product.types || product.types.length === 0) && (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                        data-testid="product-table-status"
                      >
                        {product.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(product)} data-testid="edit-product-button">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          className="text-red-500 hover:text-red-700"
                          data-testid="delete-product-button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6" data-testid="products-pagination">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) pageNum = i + 1;
              else if (currentPage <= 4) pageNum = i + 1;
              else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = currentPage - 3 + i;
              return (
                <Button key={pageNum} variant={currentPage === pageNum ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(pageNum)} className={currentPage === pageNum ? 'bg-violet-600' : ''}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminProducts;
