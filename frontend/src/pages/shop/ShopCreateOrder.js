import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2, ShoppingBag, Search, Package, MapPin, User, Mail, Phone, CheckCircle, Wallet, CreditCard, Banknote } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import StateSelect from '../../components/StateSelect';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../../lib/i18n';

const ShopCreateOrder = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const [states, setStates] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [shippingAddress, setShippingAddress] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState(0);
  const [variantPicker, setVariantPicker] = useState({ open: false, product: null, color: null, size: null, shape: null });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [walletBalance, setWalletBalance] = useState(0);
  const [availableDelivery, setAvailableDelivery] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchStates();
    fetchCommissionRate();
    fetchWalletBalance();
    // Fetch platform setting for delivery availability
    api.admin.getPlatformSettings().then(({ data }) => {
      setAvailableDelivery(data?.available_delivery !== false);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setFilteredProducts(products.filter(p =>
        p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      ));
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      const { data } = await api.shop.getProducts();
      setProducts(data.filter(p => p.is_active && p.stock > 0));
    } catch (error) {
      console.error('Failed to fetch products', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const { data } = await api.states.getAll();
      setStates(data);
    } catch (error) {
      console.error('Failed to fetch states');
    }
  };

  const fetchCommissionRate = async () => {
    try {
      const { data: tierData } = await api.shopTier.getInfo();
      if (tierData?.commission_rate) { setCommissionRate(tierData.commission_rate); return; }
      const { data } = await api.admin.getPlatformSettings();
      const tier = tierData?.current_tier || 'starter';
      const tierConfig = data.tiers?.[tier];
      setCommissionRate(tierConfig?.commission_rate || data.commission_percentage || 10);
    } catch (error) { setCommissionRate(10); }
  };

  const fetchWalletBalance = async () => {
    try {
      const { data } = await api.shopWallet.get();
      setWalletBalance(data?.balance || 0);
    } catch (error) { setWalletBalance(0); }
  };

  const getCustomerPrice = (price) => {
    if (!price) return 0;
    return Math.round(price * (1 + commissionRate / 100) * 100) / 100;
  };

  const addToOrder = (product, selectedColor = null, selectedSize = null, selectedShape = null) => {
    let maxStock = product.stock;
    let variantImage = product.images?.[0];
    let variantPrice = product.discount_price || product.price;
    const variantLabels = [];

    if (selectedColor) {
      const c = product.colors?.find(x => x.color_name === selectedColor);
      if (c) {
        maxStock = c.stock ?? maxStock;
        variantImage = c.image_url || variantImage;
        if (c.discount_price ?? c.price) variantPrice = c.discount_price ?? c.price;
        variantLabels.push(selectedColor);
      }
    }
    if (selectedSize) {
      const s = product.sizes?.find(x => x.size_name === selectedSize);
      if (s) {
        if (!selectedColor) maxStock = s.stock ?? maxStock;
        if (s.discount_price ?? s.price) variantPrice = s.discount_price ?? s.price;
        variantLabels.push(selectedSize);
      }
    }
    if (selectedShape) {
      const sh = product.shapes?.find(x => x.shape_name === selectedShape);
      if (sh) {
        if (!selectedColor && !selectedSize) maxStock = sh.stock ?? maxStock;
        if (sh.discount_price ?? sh.price) variantPrice = sh.discount_price ?? sh.price;
        variantLabels.push(selectedShape);
      }
    }

    const existingIndex = orderItems.findIndex(
      item => item.product_id === product.id
        && item.selected_color === selectedColor
        && item.selected_size === selectedSize
        && item.selected_shape === selectedShape
    );
    if (existingIndex >= 0) {
      const updated = [...orderItems];
      if (updated[existingIndex].quantity >= maxStock) {
        toast.error(`Only ${maxStock} available in stock`);
        return;
      }
      updated[existingIndex].quantity += 1;
      setOrderItems(updated);
    } else {
      if (maxStock <= 0) {
        toast.error('This variant is out of stock');
        return;
      }
      setOrderItems([...orderItems, {
        product_id: product.id,
        name: product.name + (variantLabels.length ? ` (${variantLabels.join(' / ')})` : ''),
        image: variantImage,
        price: getCustomerPrice(variantPrice),
        selected_color: selectedColor,
        selected_size: selectedSize,
        selected_shape: selectedShape,
        quantity: 1,
        stock: maxStock,
      }]);
    }
    toast.success(`${product.name} added`);
  };

  const openVariantPicker = (product) => {
    const hasColor = product.colors?.length > 0;
    const hasSize = product.has_size_variants && product.sizes?.length > 0;
    const hasShape = product.has_shape_variants && product.shapes?.length > 0;
    if (!hasColor && !hasSize && !hasShape) {
      addToOrder(product);
      return;
    }
    setVariantPicker({ open: true, product, color: null, size: null, shape: null });
  };

  const confirmVariantPicker = () => {
    const { product, color, size, shape } = variantPicker;
    if (!color && !size && !shape) {
      toast.error('Please select at least one variant');
      return;
    }
    addToOrder(product, color, size, shape);
    setVariantPicker({ open: false, product: null, color: null, size: null, shape: null });
  };

  const updateQuantity = (index, delta) => {
    const updated = [...orderItems];
    const newQty = updated[index].quantity + delta;
    if (newQty < 1) return;
    if (newQty > updated[index].stock) {
      toast.error(`Only ${updated[index].stock} available`);
      return;
    }
    updated[index].quantity = newQty;
    setOrderItems(updated);
  };

  const removeItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const selectedState = states.find(s => s.name === shippingAddress.state);
  const deliveryFee = (availableDelivery && selectedState) ? selectedState.delivery_fee : 0;
  // Shop ordering gets half commission as discount
  const commissionAmount = subtotal > 0 ? Math.round(subtotal * (commissionRate / 100) / (1 + commissionRate / 100) * 100) / 100 : 0;
  const shopOrderDiscount = commissionAmount > 0 ? Math.round(commissionAmount / 2 * 100) / 100 : 0;
  const total = subtotal + deliveryFee - shopOrderDiscount;

  const handleSubmit = async () => {
    if (!customerInfo.name) {
      toast.error('Customer name is required');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Please add at least one product');
      return;
    }
    if (availableDelivery && (!shippingAddress.address || !shippingAddress.city || !shippingAddress.state)) {
      toast.error('Please fill in shipping address');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.shop.createOrder({
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        shipping_address: shippingAddress,
        items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_color: item.selected_color,
          selected_size: item.selected_size,
          selected_shape: item.selected_shape,
        })),
        payment_method: paymentMethod,
      });
      setSuccessOrder(data);
      toast.success('Order created successfully!');
      if (paymentMethod === 'wallet') fetchWalletBalance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  // Shared Order Summary + Customer Info component (used in both desktop sidebar and mobile modal)
  const OrderSummaryAndCustomerInfo = ({ isMobile = false }) => (
    <div className="space-y-4">
      {/* Order Items */}
      {orderItems.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <ShoppingBag className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No items added yet. Select products to get started.</p>
        </div>
      ) : (
        <div className={`space-y-2 ${isMobile ? 'max-h-48 overflow-y-auto' : ''}`}>
          {orderItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl" data-testid={`order-item-${idx}`}>
              {item.image && (
                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {item.selected_color && <span className="text-violet-600">Color: {item.selected_color}</span>}
                  {item.selected_size && <span className="text-blue-600">Size: {item.selected_size}</span>}
                  {item.selected_shape && <span className="text-amber-600">Shape: {item.selected_shape}</span>}
                </div>
                <p className="text-sm font-bold text-emerald-600">${item.price.toFixed(2)} x {item.quantity}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => updateQuantity(idx, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300"><Minus className="h-3 w-3" /></button>
                <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(idx, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200 hover:bg-slate-300"><Plus className="h-3 w-3" /></button>
                <button onClick={() => removeItem(idx)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 ml-1"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {orderItems.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-600">Subtotal</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div>
          {availableDelivery && (
            <div className="flex justify-between text-sm"><span className="text-slate-600">Delivery Fee</span><span className="font-semibold">${deliveryFee.toFixed(2)}</span></div>
          )}
          {shopOrderDiscount > 0 && (
            <div className="flex justify-between text-sm"><span className="text-emerald-600 font-medium">Shop Ordering Discount</span><span className="font-semibold text-emerald-600">-${shopOrderDiscount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-lg font-bold border-t border-emerald-200 pt-2"><span>Total</span><span className="text-emerald-600">${total.toFixed(2)}</span></div>
          {shopOrderDiscount > 0 && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">You save ${shopOrderDiscount.toFixed(2)} as a shop ordering discount + earn loyalty points!</p>
          )}
        </div>
      )}

      {/* Customer Information */}
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><User className="h-4 w-4 text-emerald-600" /> Customer Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">Name *</Label>
            <Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} placeholder="Full name" data-testid="customer-name" />
          </div>
          <div>
            <Label className="text-xs mb-1">Email</Label>
            <Input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} placeholder="customer@email.com" data-testid="customer-email" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1">Phone</Label>
            <Input value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} placeholder="+961 71 234 567" data-testid="customer-phone" />
          </div>
        </div>
      </div>

      {/* Shipping (hidden when delivery is disabled platform-wide) */}
      {availableDelivery && (
      <div className="border-t pt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-600" /> Shipping Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1">Address *</Label>
            <Input value={shippingAddress.address} onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })} placeholder="Street address" data-testid="shipping-address" />
          </div>
          <div>
            <Label className="text-xs mb-1">City *</Label>
            <Input value={shippingAddress.city} onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })} placeholder="City" data-testid="shipping-city" />
          </div>
          <div>
            <Label className="text-xs mb-1">State *</Label>
            <StateSelect value={shippingAddress.state} onChange={(val) => setShippingAddress({ ...shippingAddress, state: val })} />
          </div>
          <div>
            <Label className="text-xs mb-1">ZIP</Label>
            <Input value={shippingAddress.zip} onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })} placeholder="ZIP" data-testid="shipping-zip" />
          </div>
        </div>
      </div>
      )}

      {/* Payment Method */}
      {orderItems.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-600" /> Payment Method</h3>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
            <div className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors">
              <RadioGroupItem value="cod" id="pm-cod" />
              <Label htmlFor="pm-cod" className="flex items-center gap-2 cursor-pointer flex-1">
                <Banknote className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium">Cash on Delivery</p>
                  <p className="text-[10px] text-slate-400">Customer pays when order arrives</p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={() => { handleSubmit(); if (isMobile) setCartModalOpen(false); }}
        disabled={submitting || orderItems.length === 0 || !customerInfo.name}
        className="w-full h-12 text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-lg"
        data-testid="place-order-btn"
      >
        {submitting ? (
          <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</span>
        ) : (
          <span className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /> Place Order (${total.toFixed(2)})</span>
        )}
      </Button>
    </div>
  );

  const handleCloseSuccessPopup = () => {
    setSuccessOrder(null);
    setOrderItems([]);
    setCustomerInfo({ name: '', email: '', phone: '' });
    setShippingAddress({ address: '', city: '', state: '', zip: '' });
    setPaymentMethod('cod');
  };

  return (
    <ShopLayout>
      <div className="flex-1 overflow-y-auto p-1 sm:p-2 lg:p-4 shop-table-page compact-table" data-testid="shop-create-order">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-emerald-100 rounded-xl p-2.5">
            <ShoppingBag className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create Order for Customer</h1>
            <p className="text-slate-500 text-sm">Select your products and enter customer details</p>
          </div>
        </div>

        {/* Desktop: Two-column layout. Mobile: Full-width products */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Product Selection */}
          <div className="space-y-4">
            {/* Search */}
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search your products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="product-search"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600" />
                Your Products ({filteredProducts.length})
              </h3>
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-48" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="border rounded-xl overflow-hidden hover:shadow-md transition-shadow group" data-testid={`shop-product-${product.id}`}>
                      <div className="aspect-square bg-slate-50 relative">
                        <img src={product.images?.[0] || '/placeholder.png'} alt={product.name} className="w-full h-full object-cover" />
                        {product.stock <= 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">OUT OF STOCK</span>
                          </div>
                        )}
                        {product.stock > 0 && product.stock < 10 && (
                          <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {product.stock} left
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <h4 className="text-xs font-semibold line-clamp-2 mb-1">{product.name}</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-emerald-600">
                            ${getCustomerPrice(product.discount_price || product.price).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400">Stock: {product.stock}</span>
                        </div>
                        {(() => {
                          const hasColor = product.colors?.length > 0;
                          const hasSize = product.has_size_variants && product.sizes?.length > 0;
                          const hasShape = product.has_shape_variants && product.shapes?.length > 0;
                          const hasAnyVariant = hasColor || hasSize || hasShape;
                          if (hasAnyVariant) {
                            return (
                              <Button
                                size="sm"
                                onClick={() => openVariantPicker(product)}
                                disabled={product.stock <= 0}
                                className="w-full mt-2 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                data-testid={`select-variant-${product.id}`}
                              >
                                <Package className="h-3 w-3 mr-1" /> Select Variant
                              </Button>
                            );
                          }
                          return (
                            <Button
                              size="sm"
                              onClick={() => addToOrder(product)}
                              disabled={product.stock <= 0}
                              className="w-full mt-2 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              data-testid={`add-product-${product.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop: Order Summary & Customer Info Sidebar */}
          <div className="hidden lg:block" data-testid="desktop-order-sidebar">
            <div className="sticky top-4 bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Order Summary ({orderItems.reduce((sum, i) => sum + i.quantity, 0)} items)
                </h3>
              </div>
              <div className="p-5 max-h-[calc(100vh-120px)] overflow-y-auto">
                <OrderSummaryAndCustomerInfo />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Floating Action Button - Cart (visible on small screens only) */}
        <button
          onClick={() => setCartModalOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-2xl hover:shadow-emerald-300/50 hover:scale-110 transition-all"
          data-testid="cart-fab"
        >
          <ShoppingBag className="h-7 w-7" />
          {orderItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
              {orderItems.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          )}
        </button>

        {/* Mobile: Cart & Customer Info Modal */}
        <Dialog open={cartModalOpen} onOpenChange={setCartModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
                Order Summary ({orderItems.length} items)
              </DialogTitle>
            </DialogHeader>
            <OrderSummaryAndCustomerInfo isMobile={true} />
          </DialogContent>
        </Dialog>

        {/* Variant Picker Dialog */}
        <Dialog open={variantPicker.open} onOpenChange={(v) => !v && setVariantPicker({ open: false, product: null, color: null, size: null, shape: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                Select Variant
              </DialogTitle>
            </DialogHeader>
            {variantPicker.product && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <img src={variantPicker.product.images?.[0]} alt={variantPicker.product.name} className="w-14 h-14 rounded-lg object-cover" />
                  <div>
                    <p className="font-semibold text-sm">{variantPicker.product.name}</p>
                    <p className="text-xs text-slate-500">Pick one or more variant options</p>
                  </div>
                </div>

                {/* Colors */}
                {variantPicker.product.colors?.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {variantPicker.product.colors.map((c, idx) => {
                        const disabled = (c.stock ?? 0) <= 0;
                        const selected = variantPicker.color === c.color_name;
                        return (
                          <button key={idx} disabled={disabled}
                            onClick={() => setVariantPicker({ ...variantPicker, color: selected ? null : c.color_name })}
                            className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : selected ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-semibold' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'}`}
                            data-testid={`variant-color-${c.color_name}`}>
                            {c.color_name} <span className="text-[10px] text-slate-400">({c.stock ?? 0})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sizes */}
                {variantPicker.product.has_size_variants && variantPicker.product.sizes?.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Size</Label>
                    <div className="flex flex-wrap gap-2">
                      {variantPicker.product.sizes.map((s, idx) => {
                        const disabled = (s.stock ?? 0) <= 0;
                        const selected = variantPicker.size === s.size_name;
                        return (
                          <button key={idx} disabled={disabled}
                            onClick={() => setVariantPicker({ ...variantPicker, size: selected ? null : s.size_name })}
                            className={`min-w-[3rem] px-3 py-1.5 rounded-lg border text-xs transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : selected ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'}`}
                            data-testid={`variant-size-${s.size_name}`}>
                            {s.size_name} <span className="text-[10px] text-slate-400">({s.stock ?? 0})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Shapes */}
                {variantPicker.product.has_shape_variants && variantPicker.product.shapes?.length > 0 && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">Shape</Label>
                    <div className="flex flex-wrap gap-2">
                      {variantPicker.product.shapes.map((sh, idx) => {
                        const disabled = (sh.stock ?? 0) <= 0;
                        const selected = variantPicker.shape === sh.shape_name;
                        return (
                          <button key={idx} disabled={disabled}
                            onClick={() => setVariantPicker({ ...variantPicker, shape: selected ? null : sh.shape_name })}
                            className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : selected ? 'bg-amber-50 border-amber-500 text-amber-700 font-semibold' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'}`}
                            data-testid={`variant-shape-${sh.shape_name}`}>
                            {sh.shape_name} <span className="text-[10px] text-slate-400">({sh.stock ?? 0})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setVariantPicker({ open: false, product: null, color: null, size: null, shape: null })}>Cancel</Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={confirmVariantPicker} data-testid="variant-confirm-btn">
                    <Plus className="h-4 w-4 mr-1" /> Add to Order
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Order Success Popup Dialog */}
      <Dialog open={!!successOrder} onOpenChange={(open) => { if (!open) handleCloseSuccessPopup(); }}>
        <DialogContent className="sm:max-w-md" data-testid="order-success-popup">
          <DialogHeader>
            <DialogTitle className="sr-only">Order Completed</DialogTitle>
            <DialogDescription className="sr-only">Your order has been placed successfully</DialogDescription>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-900">Order Completed!</h2>
            <p className="text-slate-500 mb-4">Your order has been placed successfully</p>
            
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-left mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Order ID</span>
                <span className="font-mono font-semibold text-sm">#{successOrder?.id?.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Customer</span>
                <span className="font-semibold text-sm">{successOrder?.customer_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Total Amount</span>
                <span className="text-lg font-bold text-emerald-600">${successOrder?.total_amount?.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-slate-500">Payment Method</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  successOrder?.payment_method === 'wallet' 
                    ? 'bg-violet-100 text-violet-700' 
                    : successOrder?.payment_method === 'card'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {successOrder?.payment_method === 'wallet' && <Wallet className="h-3.5 w-3.5" />}
                  {successOrder?.payment_method === 'card' && <CreditCard className="h-3.5 w-3.5" />}
                  {successOrder?.payment_method === 'cod' && <Banknote className="h-3.5 w-3.5" />}
                  {successOrder?.payment_method === 'wallet' ? 'Wallet' : successOrder?.payment_method === 'card' ? 'Card' : 'Cash on Delivery'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleCloseSuccessPopup} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="create-another-order-btn">
                Create Another Order
              </Button>
              <Button variant="outline" onClick={() => navigate('/shop/orders')} className="flex-1" data-testid="view-orders-btn">
                View Orders
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ShopLayout>
  );
};

export default ShopCreateOrder;
