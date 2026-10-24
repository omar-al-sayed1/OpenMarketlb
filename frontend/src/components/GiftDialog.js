import React, { useState, useEffect } from 'react';
import { Gift, Search, Plus, X, Upload, Loader2, Package, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ImageUploader from './ImageUploader';
import { api } from '../lib/api';
import { toast } from 'sonner';

const GiftDialog = ({ open, onOpenChange, productId, productName, products: externalProducts, onGiftSaved }) => {
  const [tab, setTab] = useState('gift_only'); // 'existing_product' or 'gift_only'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [giftName, setGiftName] = useState('');
  const [giftImage, setGiftImage] = useState('');
  const [giftStock, setGiftStock] = useState('');
  const [existingGift, setExistingGift] = useState(null);

  // If no productId passed, show product picker
  const [pickedProductId, setPickedProductId] = useState(productId);
  const [pickedProductName, setPickedProductName] = useState(productName);
  const [showProductPicker, setShowProductPicker] = useState(!productId);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      setPickedProductId(productId);
      setPickedProductName(productName);
      setShowProductPicker(!productId);
      if (productId) {
        fetchExistingGift(productId);
      } else {
        // Reset form for "Add Gift" button
        setExistingGift(null);
        setGiftName('');
        setGiftImage('');
        setGiftStock('');
        setSelectedProduct(null);
        setTab('gift_only');
      }
      fetchProducts();
    }
  }, [open, productId]);

  const fetchExistingGift = async (pid) => {
    try {
      const { data } = await api.shopGifts.getProductGift(pid);
      if (data.gift) {
        setExistingGift(data.gift);
        setTab(data.gift.gift_type);
        setGiftStock(data.gift.gift_stock !== null && data.gift.gift_stock !== undefined ? String(data.gift.gift_stock) : '');
        if (data.gift.gift_type === 'gift_only') {
          setGiftName(data.gift.gift_name || '');
          setGiftImage(data.gift.gift_image || '');
        } else {
          setSelectedProduct({ id: data.gift.gift_product_id, name: data.gift.gift_name });
        }
      } else {
        setExistingGift(null);
        setGiftName('');
        setGiftImage('');
        setGiftStock('');
        setSelectedProduct(null);
      }
    } catch (e) { /* no existing gift */ }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.shop.getProducts();
      setProducts((data.products || data || []).filter(p => p.id !== pickedProductId));
    } catch (e) {
      console.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handlePickProduct = (prod) => {
    setPickedProductId(prod.id);
    setPickedProductName(prod.name);
    setShowProductPicker(false);
    fetchExistingGift(prod.id);
  };

  const handleSave = async () => {
    if (!pickedProductId) {
      toast.error('Please select a product first');
      return;
    }
    setSaving(true);
    try {
      const payload = { gift_type: tab };
      if (tab === 'existing_product') {
        if (!selectedProduct) {
          toast.error('Please select a product as gift');
          setSaving(false);
          return;
        }
        payload.gift_product_id = selectedProduct.id;
      } else {
        if (!giftName.trim()) {
          toast.error('Please enter a gift name');
          setSaving(false);
          return;
        }
        payload.gift_name = giftName;
        payload.gift_image = giftImage;
      }
      
      // Add stock if provided
      if (giftStock !== '' && giftStock !== null && giftStock !== undefined) {
        payload.gift_stock = parseInt(giftStock);
      } else {
        payload.gift_stock = null; // unlimited
      }
      
      await api.shopGifts.setGift(pickedProductId, payload);
      toast.success('Gift attached successfully!');
      onOpenChange(false);
      if (onGiftSaved) onGiftSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save gift');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveGift = async () => {
    if (!pickedProductId) return;
    try {
      await api.shopGifts.removeGift(pickedProductId);
      toast.success('Gift removed from this product');
      setExistingGift(null);
      setGiftName('');
      setGiftImage('');
      setGiftStock('');
      setSelectedProduct(null);
      onOpenChange(false);
      if (onGiftSaved) onGiftSaved();
    } catch (e) {
      toast.error('Failed to remove gift');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allProducts = externalProducts || products;
  const filteredPickerProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg p-1.5">
              <Gift className="h-4 w-4 text-white" />
            </div>
            {existingGift ? 'Edit Gift' : 'Add Free Gift'}
          </DialogTitle>
          {pickedProductName && !showProductPicker && (
            <p className="text-sm text-slate-500 mt-1">For: <strong>{pickedProductName}</strong>
              {!productId && (
                <button onClick={() => setShowProductPicker(true)} className="ml-2 text-xs text-violet-600 hover:underline">Change</button>
              )}
            </p>
          )}
        </DialogHeader>

        {/* Product Picker (when no product pre-selected) */}
        {showProductPicker ? (
          <div className="space-y-3 mt-2">
            <p className="text-sm font-medium text-slate-700">Select a product to attach a gift to:</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                placeholder="Search your products..."
                className="pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-xl p-2">
              {filteredPickerProducts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No products found</p>
              ) : (
                filteredPickerProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handlePickProduct(p)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all hover:bg-pink-50"
                  >
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Package className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">${(p.original_price || p.price)?.toFixed(2)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setTab('gift_only')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                  tab === 'gift_only'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Plus className="h-4 w-4 inline mr-1" /> Create Gift Item
              </button>
              <button
                onClick={() => setTab('existing_product')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                  tab === 'existing_product'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Package className="h-4 w-4 inline mr-1" /> Choose Existing
              </button>
            </div>

            {tab === 'gift_only' ? (
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm font-medium">Gift Name *</Label>
                  <Input
                    value={giftName}
                    onChange={(e) => setGiftName(e.target.value)}
                    placeholder="e.g., Premium Phone Case, Sample Product"
                    className="mt-1"
                    data-testid="gift-name-input"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Gift Image</Label>
                  <div className="mt-1">
                    <ImageUploader
                      value={giftImage}
                      onChange={setGiftImage}
                      label="Upload gift image"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Gift Stock (leave empty for unlimited)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={giftStock}
                    onChange={(e) => setGiftStock(e.target.value)}
                    placeholder="Unlimited"
                    className="mt-1"
                    data-testid="gift-stock-input"
                  />
                  <p className="text-xs text-slate-400 mt-1">How many of this gift do you have in stock?</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700">
                    <Gift className="h-3 w-3 inline mr-1" />
                    This gift will be a mystery to customers until they purchase the product!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search your products..."
                    className="pl-9"
                    data-testid="gift-search-input"
                  />
                </div>
                
                {selectedProduct && (
                  <div className="flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-xl p-3">
                    <Check className="h-4 w-4 text-pink-600" />
                    <span className="text-sm font-medium text-pink-800 flex-1">Selected: {selectedProduct.name}</span>
                    <button onClick={() => setSelectedProduct(null)} className="text-pink-500 hover:text-pink-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-xl p-2">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No products found</p>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                          selectedProduct?.id === p.id
                            ? 'bg-pink-100 border border-pink-300'
                            : 'hover:bg-slate-50'
                        }`}
                        data-testid={`gift-product-${p.id}`}
                      >
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Package className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-slate-400">${(p.original_price || p.price)?.toFixed(2)}</p>
                        </div>
                        {selectedProduct?.id === p.id && (
                          <Check className="h-4 w-4 text-pink-600 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Stock for existing product gift */}
                <div>
                  <Label className="text-sm font-medium">Gift Stock (leave empty for unlimited)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={giftStock}
                    onChange={(e) => setGiftStock(e.target.value)}
                    placeholder="Unlimited"
                    className="mt-1"
                    data-testid="gift-stock-input-existing"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {existingGift && (
                <Button variant="outline" onClick={handleRemoveGift} className="text-red-500 border-red-200 hover:bg-red-50">
                  Remove Gift
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
                data-testid="save-gift-btn"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
                {existingGift ? 'Update Gift' : 'Attach Gift'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GiftDialog;
