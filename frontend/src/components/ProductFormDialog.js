import React from 'react';
import { Plus, X, Sparkles, Wand2, Palette, Ruler, Box, DollarSign, Package, Check, ChevronRight, Loader2, Info, Layers, Percent, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import MultiImageUploader from './MultiImageUploader';
import ImageUploader from './ImageUploader';
import CategoryTreeSelect from './CategoryTreeSelect';

const SHAPE_OPTIONS = [
  'Round', 'Square', 'Rectangle', 'Oval', 'Heart', 'Star', 'Triangle',
  'Hexagon', 'Diamond', 'Cylinder', 'Cone', 'Sphere', 'Cube', 'Custom'
];
const SIZE_OPTIONS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Custom'];

/**
 * Shared, unified Add/Edit Product modal used by BOTH the shop products page and
 * the admin products page so they look exactly the same.
 *
 * Optional behaviours toggled via props:
 *  - enableAI + onAiGenerate (shop)
 *  - shops (admin shop selector)
 *  - suggestedCategoryObjects + toggleCategoryQuick (shop)
 */
const ProductFormDialog = ({
  editingProduct,
  formData,
  setFormData,
  categories,
  variantToggles,
  commissionRate,
  commissionType,
  calculateCustomerPrice,
  calculateShopRevenue,
  getCommissionTypeLabel,
  onSubmit,
  onCancel,
  // shop-only
  enableAI = false,
  onAiGenerate,
  aiLoading = false,
  aiAccent = false,
  suggestedCategoryObjects = [],
  toggleCategoryQuick,
  // admin-only
  shops = null,
}) => {
  const enabledVariantCount = [formData.has_color_variants, formData.has_size_variants, formData.has_shape_variants, formData.has_type_variants].filter(Boolean).length;
  const handleCategoryChange = (selectedIds) => setFormData({ ...formData, category_ids: selectedIds });
  const showShopSelector = Array.isArray(shops);

  return (
    <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0" data-testid="product-dialog">
      {/* Sticky modal header with gradient */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-6 py-5 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight">{editingProduct ? 'Edit Product' : 'Create New Product'}</span>
              <p className="text-[11px] text-white/70 font-normal mt-0.5">Fill in the details below{enableAI ? ' — or let AI help' : ''}</p>
            </div>
          </DialogTitle>
        </DialogHeader>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-6 bg-gradient-to-b from-slate-50 to-white">
        {/* === STEP 1: BASICS === */}
        <section className={`relative rounded-2xl border-2 ${aiAccent ? 'border-fuchsia-300 ring-4 ring-fuchsia-100' : 'border-slate-200'} bg-white p-5 transition-all`}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-black">1</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Product Basics</h3>
            {enableAI && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-full px-2 py-0.5">
                <Wand2 className="h-2.5 w-2.5" /> AI Assist
              </span>
            )}
          </div>

          {enableAI && (
            <div className="mb-4 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-pink-50 rounded-xl border border-fuchsia-200 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Wand2 className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm leading-tight">Smart AI Assistant</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Type a product name (or upload an image) and let AI write the description and pick categories.</p>
                </div>
                <Button
                  type="button"
                  onClick={onAiGenerate}
                  disabled={aiLoading}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl h-9 px-3 sm:px-4 shadow-md shadow-fuchsia-500/25 text-xs font-bold whitespace-nowrap"
                  data-testid="ai-generate-product-btn"
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1" /> : <Sparkles className="h-3.5 w-3.5 sm:mr-1" />}
                  <span className="hidden sm:inline">{aiLoading ? 'Thinking…' : 'Generate'}</span>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* Shop selector (admin only) */}
            {showShopSelector && (
              <div>
                <Label htmlFor="shop_id" className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="h-3 w-3 text-violet-500" /> Shop *
                </Label>
                <select
                  id="shop_id"
                  value={formData.shop_id || ''}
                  onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                  className="mt-1.5 flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:ring-violet-400/20"
                  data-testid="product-shop-select"
                >
                  <option value="">-- Select a Shop --</option>
                  {shops.filter(s => s.subscription_status === 'active' || s.subscription_status === 'trial').map(shop => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
                {formData.shop_id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" data-testid="shop-commission-info">
                    <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-semibold">Commission: {commissionRate}%</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold ${
                      commissionType === 'on_shop' ? 'bg-amber-100 text-amber-700' :
                      commissionType === 'half_half' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`} data-testid="commission-type-badge">{getCommissionTypeLabel()}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="name" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Handcrafted Leather Wallet"
                className="mt-1.5 h-11 rounded-xl border-slate-200 focus:border-violet-400 focus:ring-violet-400/20"
                data-testid="product-name-input"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="description" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description *</Label>
                {formData.description?.length > 0 && (
                  <span className="text-[10px] text-slate-400">{formData.description.length} chars</span>
                )}
              </div>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
                placeholder="Describe the product features, materials, sizing, etc."
                className="rounded-xl border-slate-200 focus:border-violet-400 focus:ring-violet-400/20"
                data-testid="product-description-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gender" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Target Audience</Label>
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="mt-1.5 flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:ring-violet-400/20"
                  data-testid="product-gender-select"
                >
                  <option value="none">Everyone</option>
                  <option value="male">Men</option>
                  <option value="female">Women</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between w-full px-3 py-2 rounded-xl border-2 border-emerald-100 bg-emerald-50/50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${formData.is_active ? 'bg-emerald-500 shadow-sm shadow-emerald-300' : 'bg-slate-300'}`} />
                    <Label htmlFor="is_active" className="cursor-pointer text-sm font-semibold text-slate-700">{formData.is_active ? 'Active' : 'Inactive'}</Label>
                  </div>
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* === STEP 2: CATEGORIES === */}
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">2</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Categories</h3>
            {formData.category_ids.length > 0 && (
              <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                {formData.category_ids.length} selected
              </span>
            )}
          </div>

          {suggestedCategoryObjects.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-emerald-50 border border-violet-100" data-testid="suggested-categories-section">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Suggested for your shop</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedCategoryObjects.map(cat => {
                  const isSel = formData.category_ids.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategoryQuick && toggleCategoryQuick(cat.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                        isSel ? 'bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-300' : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-100 hover:border-violet-300'
                      }`}
                      data-testid={`suggested-cat-${cat.id}`}
                    >
                      {cat.name}
                      {isSel && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">All categories</Label>
          <CategoryTreeSelect tree={categories} selectedIds={formData.category_ids} onChange={handleCategoryChange} />
        </section>

        {/* === STEP 3: VARIANTS === */}
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5" data-testid="variant-toggle-section">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-black">3</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Variants</h3>
            {enabledVariantCount > 0 && (
              <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {enabledVariantCount} type{enabledVariantCount > 1 ? 's' : ''} enabled
              </span>
            )}
          </div>

          <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
            Enable any combination of color, size, shape, or type. Customers will choose variants before adding to cart.
          </p>

          <div className="space-y-3">
            {/* COLOR VARIANTS */}
            {variantToggles.variant_color_enabled && (
            <div className={`rounded-xl border-2 ${formData.has_color_variants ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'} transition-all`}>
              <label className="flex items-center justify-between cursor-pointer p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${formData.has_color_variants ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Palette className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Color variants</p>
                    <p className="text-[10px] text-slate-400">Different colors with photos</p>
                  </div>
                </div>
                <Switch checked={formData.has_color_variants} onCheckedChange={(checked) => {
                  setFormData({ ...formData, has_color_variants: checked,
                    colors: checked && formData.colors.length === 0 ? [{ color_name: '', color_code: '#000000', image_url: '', stock: 0, price: null, discount_price: null }] : formData.colors
                  });
                }} data-testid="color-variant-toggle" />
              </label>

              {formData.has_color_variants && (
                <div className="px-3 pb-3 space-y-3 border-t border-violet-100 pt-3">
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-white border border-violet-100">
                    <span className="text-xs font-medium text-slate-700">Use same price for all colors?</span>
                    <Switch checked={formData.use_same_price_colors} onCheckedChange={(checked) => setFormData({ ...formData, use_same_price_colors: checked })} />
                  </label>
                  {formData.use_same_price_colors && (
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-violet-100">
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Price *</Label><Input type="number" step="0.01" min="0" value={formData.color_shared_price||''} onChange={(e)=>setFormData({...formData,color_shared_price:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.color_shared_price && parseFloat(formData.color_shared_price) > 0 && <div className="text-[10px] text-violet-600 mt-1">Customer: ${calculateCustomerPrice(formData.color_shared_price)}</div>}</div>
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Sale</Label><Input type="number" step="0.01" min="0" value={formData.color_shared_discount||''} onChange={(e)=>setFormData({...formData,color_shared_discount:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.color_shared_discount && parseFloat(formData.color_shared_discount) > 0 && <div className="text-[10px] text-emerald-600 mt-1">Customer: ${calculateCustomerPrice(formData.color_shared_discount)}</div>}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-violet-700">Color Variants</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, colors: [...formData.colors, { color_name: '', color_code: '#000000', image_url: '', stock: 0, price: null, discount_price: null }] })} className="rounded-full h-7 text-xs border-violet-200 text-violet-700 hover:bg-violet-50" data-testid="add-color-variant-btn">
                      <Plus className="h-3 w-3 mr-1" /> Add Color
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {formData.colors.map((color, index) => (
                      <div key={index} className="group relative bg-white border border-violet-100 rounded-xl p-2.5">
                        <button type="button" onClick={() => setFormData({...formData, colors: formData.colors.filter((_,i)=>i!==index)})} className="absolute top-1 right-1 opacity-50 group-hover:opacity-100 p-1 rounded-full hover:bg-red-50 text-red-400 z-10">
                          <X className="h-3 w-3" />
                        </button>
                        <div className="mb-2"><ImageUploader value={color.image_url} onChange={(url) => { setFormData(p=>({...p,colors:p.colors.map((c,i)=>i===index?{...c,image_url:url}:c)})); }} /></div>
                        <div className="flex items-center gap-1 mb-1.5">
                          <input type="color" value={color.color_code || '#000000'} onChange={(e)=>{setFormData(p=>({...p,colors:p.colors.map((c,i)=>i===index?{...c,color_code:e.target.value}:c)}));}} className="w-7 h-7 rounded border border-slate-200 cursor-pointer flex-shrink-0" title="Color preview" />
                          <Input value={color.color_name} onChange={(e)=>{setFormData(p=>({...p,colors:p.colors.map((c,i)=>i===index?{...c,color_name:e.target.value}:c)}));}} placeholder="Color name (e.g. Red)" className="text-xs h-7" data-testid={`variant-name-${index}`} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1"><Label className="text-[10px] flex-shrink-0">Stock:</Label><Input type="number" min="0" value={color.stock||''} onChange={(e)=>{setFormData(p=>({...p,colors:p.colors.map((c,i)=>i===index?{...c,stock:parseInt(e.target.value)||0}:c)}));}} className="text-xs h-7" data-testid={`variant-stock-${index}`} /></div>
                        {!formData.use_same_price_colors && (<>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input type="number" step="0.01" min="0" value={color.price||''} onChange={(e)=>{setFormData(p=>({...p,colors:p.colors.map((c,i)=>i===index?{...c,price:parseFloat(e.target.value)||null}:c)}));}} placeholder="Price" className="text-xs h-7" />
                            <Input type="number" step="0.01" min="0" value={color.discount_price||''} onChange={(e)=>{setFormData(p=>({...p,colors:p.colors.map((c,i)=>i===index?{...c,discount_price:parseFloat(e.target.value)||null}:c)}));}} placeholder="Sale" className="text-xs h-7" />
                          </div>
                          {color.price && parseFloat(color.price) > 0 && <div className="text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded mt-1">Customer: ${calculateCustomerPrice(color.price)}{color.discount_price ? ` (Sale: $${calculateCustomerPrice(color.discount_price)})` : ''}</div>}
                        </>)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* SIZE VARIANTS */}
            {variantToggles.variant_size_enabled && (
            <div className={`rounded-xl border-2 ${formData.has_size_variants ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'} transition-all`}>
              <label className="flex items-center justify-between cursor-pointer p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${formData.has_size_variants ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Ruler className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Size variants</p>
                    <p className="text-[10px] text-slate-400">XXS, XS, S, M, L, XL... or custom</p>
                  </div>
                </div>
                <Switch checked={formData.has_size_variants} onCheckedChange={(checked) => {
                  setFormData({ ...formData, has_size_variants: checked,
                    sizes: checked && formData.sizes.length === 0 ? [{ size_name: 'M', stock: 0, price: null, discount_price: null, image_url: '' }] : formData.sizes
                  });
                }} data-testid="size-variant-toggle" />
              </label>

              {formData.has_size_variants && (
                <div className="px-3 pb-3 space-y-3 border-t border-blue-100 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-white border border-blue-100">
                      <span className="text-xs font-medium text-slate-700">Same price for sizes?</span>
                      <Switch checked={formData.use_same_price_sizes} onCheckedChange={(checked) => setFormData({ ...formData, use_same_price_sizes: checked })} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-white border border-blue-100">
                      <span className="text-xs font-medium text-slate-700">Same photo for sizes?</span>
                      <Switch checked={formData.use_same_photo_sizes} onCheckedChange={(checked) => setFormData({ ...formData, use_same_photo_sizes: checked })} />
                    </label>
                  </div>

                  {formData.use_same_price_sizes && (
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-blue-100">
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Price *</Label><Input type="number" step="0.01" min="0" value={formData.size_shared_price||''} onChange={(e)=>setFormData({...formData,size_shared_price:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.size_shared_price && parseFloat(formData.size_shared_price) > 0 && <div className="text-[10px] text-blue-600 mt-1">Customer: ${calculateCustomerPrice(formData.size_shared_price)}</div>}</div>
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Sale</Label><Input type="number" step="0.01" min="0" value={formData.size_shared_discount||''} onChange={(e)=>setFormData({...formData,size_shared_discount:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.size_shared_discount && parseFloat(formData.size_shared_discount) > 0 && <div className="text-[10px] text-emerald-600 mt-1">Customer: ${calculateCustomerPrice(formData.size_shared_discount)}</div>}</div>
                    </div>
                  )}

                  {formData.use_same_photo_sizes && (
                    <div className="p-3 bg-white rounded-lg border border-blue-100">
                      <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">Shared Photo</Label>
                      <ImageUploader value={formData.size_variant_image} onChange={(url) => setFormData({...formData, size_variant_image: url})} />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-blue-700">Size Variants</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setFormData({...formData, sizes: [...formData.sizes, {size_name:'',stock:0,price:null,discount_price:null,image_url:''}]})} className="rounded-full h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                      <Plus className="h-3 w-3 mr-1" /> Add Size
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {formData.sizes.map((size, index) => (
                      <div key={index} className="group relative bg-white border border-blue-100 rounded-xl p-2.5 space-y-2">
                        <button type="button" onClick={()=>setFormData({...formData,sizes:formData.sizes.filter((_,i)=>i!==index)})} className="absolute top-1 right-1 opacity-50 group-hover:opacity-100 p-1 rounded-full hover:bg-red-50 text-red-400 z-10"><X className="h-3 w-3" /></button>
                        {!formData.use_same_photo_sizes && (
                          <div><Label className="text-[10px] text-slate-500 mb-1 block">Size Photo</Label>
                            <ImageUploader value={size.image_url} onChange={(url)=>{const s=[...formData.sizes];s[index]={...s[index],image_url:url};setFormData({...formData,sizes:s});}} /></div>
                        )}
                        <div>
                          <Label className="text-[10px] text-slate-500 mb-1 block">Size *</Label>
                          <select value={SIZE_OPTIONS.includes(size.size_name) ? size.size_name : (size.size_name ? 'Custom' : '')} onChange={(e)=>{const s=[...formData.sizes];s[index]={...s[index],size_name: e.target.value === 'Custom' ? '' : e.target.value };setFormData({...formData,sizes:s});}} className="h-9 px-2 border border-blue-200 rounded text-sm font-semibold w-full bg-blue-50/50" data-testid={`size-variant-name-${index}`}>
                            <option value="">Select size</option>
                            {SIZE_OPTIONS.map(sv => <option key={sv} value={sv}>{sv}</option>)}
                          </select>
                          {(!SIZE_OPTIONS.includes(size.size_name) || (size.size_name === '' )) && (
                            <Input value={size.size_name === '' ? '' : (SIZE_OPTIONS.includes(size.size_name) ? '' : size.size_name)} onChange={(e)=>{const s=[...formData.sizes];s[index]={...s[index],size_name:e.target.value};setFormData({...formData,sizes:s});}} placeholder="Enter custom size (e.g. 42, EU40)" className="text-xs h-8 mt-1.5" />
                          )}
                        </div>
                        <div><Label className="text-[10px] text-slate-500 mb-1 block">Stock *</Label><Input type="number" min="0" value={size.stock||''} onChange={(e)=>{const s=[...formData.sizes];s[index]={...s[index],stock:parseInt(e.target.value)||0};setFormData({...formData,sizes:s});}} placeholder="Stock qty" className="text-xs h-8" data-testid={`size-variant-stock-${index}`} /></div>
                        {!formData.use_same_price_sizes && (
                          <>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input type="number" step="0.01" min="0" value={size.price||''} onChange={(e)=>{const s=[...formData.sizes];s[index]={...s[index],price:parseFloat(e.target.value)||null};setFormData({...formData,sizes:s});}} placeholder="Price" className="text-xs h-8" />
                              <Input type="number" step="0.01" min="0" value={size.discount_price||''} onChange={(e)=>{const s=[...formData.sizes];s[index]={...s[index],discount_price:parseFloat(e.target.value)||null};setFormData({...formData,sizes:s});}} placeholder="Sale" className="text-xs h-8" />
                            </div>
                            {size.price && parseFloat(size.price) > 0 && <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Customer: ${calculateCustomerPrice(size.price)}{size.discount_price ? ` (Sale: $${calculateCustomerPrice(size.discount_price)})` : ''}</div>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* SHAPE VARIANTS */}
            {variantToggles.variant_shape_enabled && (
            <div className={`rounded-xl border-2 ${formData.has_shape_variants ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'} transition-all`}>
              <label className="flex items-center justify-between cursor-pointer p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${formData.has_shape_variants ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Box className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Shape variants</p>
                    <p className="text-[10px] text-slate-400">Round, square, heart, custom... pick from preset</p>
                  </div>
                </div>
                <Switch checked={formData.has_shape_variants} onCheckedChange={(checked) => {
                  setFormData({ ...formData, has_shape_variants: checked,
                    shapes: checked && formData.shapes.length === 0 ? [{ shape_name: '', image_url: '', stock: 0, price: null, discount_price: null }] : formData.shapes
                  });
                }} data-testid="shape-variant-toggle" />
              </label>

              {formData.has_shape_variants && (
                <div className="px-3 pb-3 space-y-3 border-t border-emerald-100 pt-3">
                  <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-white border border-emerald-100">
                    <span className="text-xs font-medium text-slate-700">Same price for shapes?</span>
                    <Switch checked={formData.use_same_price_shapes} onCheckedChange={(checked) => setFormData({ ...formData, use_same_price_shapes: checked })} />
                  </label>

                  {formData.use_same_price_shapes && (
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-emerald-100">
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Price *</Label><Input type="number" step="0.01" min="0" value={formData.shape_shared_price||''} onChange={(e)=>setFormData({...formData,shape_shared_price:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.shape_shared_price && parseFloat(formData.shape_shared_price) > 0 && <div className="text-[10px] text-emerald-600 mt-1">Customer: ${calculateCustomerPrice(formData.shape_shared_price)}</div>}</div>
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Sale</Label><Input type="number" step="0.01" min="0" value={formData.shape_shared_discount||''} onChange={(e)=>setFormData({...formData,shape_shared_discount:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.shape_shared_discount && parseFloat(formData.shape_shared_discount) > 0 && <div className="text-[10px] text-emerald-600 mt-1">Customer: ${calculateCustomerPrice(formData.shape_shared_discount)}</div>}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-emerald-700">Shape Variants</Label>
                    <Button type="button" variant="outline" size="sm" onClick={()=>setFormData({...formData,shapes:[...formData.shapes,{shape_name:'',image_url:'',stock:0,price:null,discount_price:null}]})} className="rounded-full h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <Plus className="h-3 w-3 mr-1" /> Add Shape
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {formData.shapes.map((shape, index) => (
                      <div key={index} className="group relative bg-white border border-emerald-100 rounded-xl p-2.5 space-y-2">
                        <button type="button" onClick={()=>setFormData({...formData,shapes:formData.shapes.filter((_,i)=>i!==index)})} className="absolute top-1 right-1 opacity-50 group-hover:opacity-100 p-1 rounded-full hover:bg-red-50 text-red-400 z-10"><X className="h-3 w-3" /></button>
                        <div><Label className="text-[10px] text-slate-500 mb-1 block">Shape Photo *</Label>
                          <ImageUploader value={shape.image_url} onChange={(url)=>{const s=[...formData.shapes];s[index]={...s[index],image_url:url};setFormData({...formData,shapes:s});}} /></div>
                        <div>
                          <Label className="text-[10px] text-slate-500 mb-1 block">Shape *</Label>
                          <select
                            value={SHAPE_OPTIONS.includes(shape.shape_name) ? shape.shape_name : (shape.shape_name ? 'Custom' : '')}
                            onChange={(e)=>{
                              const s=[...formData.shapes];
                              s[index]={...s[index], shape_name: e.target.value === 'Custom' ? '' : e.target.value };
                              setFormData({...formData,shapes:s});
                            }}
                            className="h-9 px-2 border border-emerald-200 rounded text-sm font-semibold w-full bg-emerald-50/50"
                            data-testid={`shape-variant-select-${index}`}
                          >
                            <option value="">Select shape</option>
                            {SHAPE_OPTIONS.map(sh => <option key={sh} value={sh}>{sh}</option>)}
                          </select>
                          {(!SHAPE_OPTIONS.includes(shape.shape_name) && shape.shape_name !== '') || shape.shape_name === '' ? (
                            <Input value={SHAPE_OPTIONS.includes(shape.shape_name) ? '' : shape.shape_name} onChange={(e)=>{const s=[...formData.shapes];s[index]={...s[index],shape_name:e.target.value};setFormData({...formData,shapes:s});}} placeholder="Custom shape name" className="text-xs h-8 mt-1.5" />
                          ) : null}
                        </div>
                        <div><Label className="text-[10px] text-slate-500 mb-1 block">Stock *</Label><Input type="number" min="0" value={shape.stock||''} onChange={(e)=>{const s=[...formData.shapes];s[index]={...s[index],stock:parseInt(e.target.value)||0};setFormData({...formData,shapes:s});}} placeholder="Stock qty" className="text-xs h-8" /></div>
                        {!formData.use_same_price_shapes && (<>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input type="number" step="0.01" min="0" value={shape.price||''} onChange={(e)=>{const s=[...formData.shapes];s[index]={...s[index],price:parseFloat(e.target.value)||null};setFormData({...formData,shapes:s});}} placeholder="Price" className="text-xs h-8" />
                            <Input type="number" step="0.01" min="0" value={shape.discount_price||''} onChange={(e)=>{const s=[...formData.shapes];s[index]={...s[index],discount_price:parseFloat(e.target.value)||null};setFormData({...formData,shapes:s});}} placeholder="Sale" className="text-xs h-8" />
                          </div>
                          {shape.price && parseFloat(shape.price) > 0 && <div className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Customer: ${calculateCustomerPrice(shape.price)}{shape.discount_price ? ` (Sale: $${calculateCustomerPrice(shape.discount_price)})` : ''}</div>}
                        </>)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* TYPE VARIANTS */}
            {variantToggles.variant_type_enabled && (
            <div className={`rounded-xl border-2 ${formData.has_type_variants ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'} transition-all`}>
              <label className="flex items-center justify-between cursor-pointer p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${formData.has_type_variants ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Type variants</p>
                    <p className="text-[10px] text-slate-400">e.g. Samsung Galaxy S24, S24 Ultra, S24 FE</p>
                  </div>
                </div>
                <Switch checked={formData.has_type_variants} onCheckedChange={(checked) => {
                  setFormData({ ...formData, has_type_variants: checked,
                    types: checked && formData.types.length === 0 ? [{ type_name: '', stock: 0, price: null, discount_price: null, image_url: '' }] : formData.types
                  });
                }} data-testid="type-variant-toggle" />
              </label>

              {formData.has_type_variants && (
                <div className="px-3 pb-3 space-y-3 border-t border-amber-100 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-white border border-amber-100">
                      <span className="text-xs font-medium text-slate-700">Same price for types?</span>
                      <Switch checked={formData.use_same_price_types} onCheckedChange={(checked) => setFormData({ ...formData, use_same_price_types: checked })} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-white border border-amber-100">
                      <span className="text-xs font-medium text-slate-700">Same photo for types?</span>
                      <Switch checked={formData.use_same_photo_types} onCheckedChange={(checked) => setFormData({ ...formData, use_same_photo_types: checked })} />
                    </label>
                  </div>

                  {formData.use_same_price_types && (
                    <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-amber-100">
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Price *</Label><Input type="number" step="0.01" min="0" value={formData.type_shared_price||''} onChange={(e)=>setFormData({...formData,type_shared_price:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.type_shared_price && parseFloat(formData.type_shared_price) > 0 && <div className="text-[10px] text-amber-600 mt-1">Customer: ${calculateCustomerPrice(formData.type_shared_price)}</div>}</div>
                      <div><Label className="text-[10px] font-bold uppercase text-slate-500">Shared Sale</Label><Input type="number" step="0.01" min="0" value={formData.type_shared_discount||''} onChange={(e)=>setFormData({...formData,type_shared_discount:e.target.value})} className="h-9 text-sm mt-1" />
                        {formData.type_shared_discount && parseFloat(formData.type_shared_discount) > 0 && <div className="text-[10px] text-emerald-600 mt-1">Customer: ${calculateCustomerPrice(formData.type_shared_discount)}</div>}</div>
                    </div>
                  )}

                  {formData.use_same_photo_types && (
                    <div className="p-3 bg-white rounded-lg border border-amber-100">
                      <Label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">Shared Photo</Label>
                      <ImageUploader value={formData.type_variant_image} onChange={(url) => setFormData({...formData, type_variant_image: url})} />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-amber-700">Type Variants</Label>
                    <Button type="button" variant="outline" size="sm" onClick={()=>setFormData({...formData,types:[...formData.types,{type_name:'',stock:0,price:null,discount_price:null,image_url:''}]})} className="rounded-full h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50" data-testid="add-type-variant-btn">
                      <Plus className="h-3 w-3 mr-1" /> Add Type
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {formData.types.map((typ, index) => (
                      <div key={index} className="group relative bg-white border border-amber-100 rounded-xl p-2.5 space-y-2">
                        <button type="button" onClick={()=>setFormData({...formData,types:formData.types.filter((_,i)=>i!==index)})} className="absolute top-1 right-1 opacity-50 group-hover:opacity-100 p-1 rounded-full hover:bg-red-50 text-red-400 z-10"><X className="h-3 w-3" /></button>
                        {!formData.use_same_photo_types && (
                          <div><Label className="text-[10px] text-slate-500 mb-1 block">Type Photo</Label>
                            <ImageUploader value={typ.image_url} onChange={(url)=>{const t=[...formData.types];t[index]={...t[index],image_url:url};setFormData({...formData,types:t});}} /></div>
                        )}
                        <div>
                          <Label className="text-[10px] text-slate-500 mb-1 block">Type Name *</Label>
                          <Input value={typ.type_name} onChange={(e)=>{const t=[...formData.types];t[index]={...t[index],type_name:e.target.value};setFormData({...formData,types:t});}} placeholder="e.g. Samsung Galaxy S24" className="text-xs h-8" data-testid={`type-variant-name-${index}`} />
                        </div>
                        <div><Label className="text-[10px] text-slate-500 mb-1 block">Stock *</Label><Input type="number" min="0" value={typ.stock||''} onChange={(e)=>{const t=[...formData.types];t[index]={...t[index],stock:parseInt(e.target.value)||0};setFormData({...formData,types:t});}} placeholder="Stock qty" className="text-xs h-8" data-testid={`type-variant-stock-${index}`} /></div>
                        {!formData.use_same_price_types && (<>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input type="number" step="0.01" min="0" value={typ.price||''} onChange={(e)=>{const t=[...formData.types];t[index]={...t[index],price:parseFloat(e.target.value)||null};setFormData({...formData,types:t});}} placeholder="Price" className="text-xs h-8" />
                            <Input type="number" step="0.01" min="0" value={typ.discount_price||''} onChange={(e)=>{const t=[...formData.types];t[index]={...t[index],discount_price:parseFloat(e.target.value)||null};setFormData({...formData,types:t});}} placeholder="Sale" className="text-xs h-8" />
                          </div>
                          {typ.price && parseFloat(typ.price) > 0 && <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Customer: ${calculateCustomerPrice(typ.price)}{typ.discount_price ? ` (Sale: $${calculateCustomerPrice(typ.discount_price)})` : ''}</div>}
                        </>)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Total Stock */}
            {enabledVariantCount > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-xl">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Stock</span>
                <span className="text-base font-black" data-testid="variant-total-stock">
                  {[...formData.colors, ...formData.sizes, ...formData.shapes, ...formData.types].reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)} units
                </span>
              </div>
            )}

            {/* Variant Selection Mode */}
            {enabledVariantCount >= 2 && (
              <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4" data-testid="variant-selection-mode">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Variant Selection Mode</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Decide if customers pick <strong>only one</strong> variant type or <strong>multiple</strong> at once (e.g., color + size for clothes).</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, variant_selection_mode: 'single' })}
                    className={`text-left px-3 py-3 rounded-xl border-2 transition-all ${
                      formData.variant_selection_mode === 'single' ? 'bg-white border-violet-600 shadow-md shadow-violet-200' : 'border-slate-200 bg-white/60 hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {formData.variant_selection_mode === 'single' && <Check className="h-4 w-4 text-violet-600" />}
                      <span className="text-sm font-bold text-slate-800">Single variant</span>
                    </div>
                    <span className="block text-[11px] text-slate-500 mt-1">Customer picks ONE type only (e.g., either color or size).</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, variant_selection_mode: 'multi' })}
                    className={`text-left px-3 py-3 rounded-xl border-2 transition-all ${
                      formData.variant_selection_mode === 'multi' ? 'bg-white border-violet-600 shadow-md shadow-violet-200' : 'border-slate-200 bg-white/60 hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {formData.variant_selection_mode === 'multi' && <Check className="h-4 w-4 text-violet-600" />}
                      <span className="text-sm font-bold text-slate-800">Multi variant <span className="text-[10px] text-violet-600 font-normal">(clothes)</span></span>
                    </div>
                    <span className="block text-[11px] text-slate-500 mt-1">Customer picks multiple types (e.g., color AND size).</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* === STEP 4: PRICING (only if no variants) === */}
        {enabledVariantCount === 0 && (
          <section className="rounded-2xl border-2 border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-black">4</div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Pricing & Stock</h3>
            </div>

            <div className="mb-4 p-3 bg-gradient-to-r from-slate-50 to-violet-50 rounded-xl border border-violet-100 flex items-center gap-2 text-xs">
              <Percent className="h-3.5 w-3.5 text-violet-600" />
              <span className="font-bold text-slate-800">Commission: {commissionRate}% · {getCommissionTypeLabel()}</span>
              <span className="ml-auto text-[10px] text-slate-500">
                {commissionType === 'on_shop' && 'deducted from shop revenue'}
                {commissionType === 'on_customer' && 'added to customer price'}
                {commissionType === 'half_half' && 'split with customer'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{showShopSelector ? 'Shop Price *' : 'Your Price *'}</Label>
                <div className="relative mt-1.5">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="price" type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" required className="text-base font-bold pl-9 h-11 rounded-xl border-slate-200 focus:border-violet-400" data-testid="product-price-input" />
                </div>
                {formData.price && parseFloat(formData.price) > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="p-2.5 bg-violet-50 rounded-lg border border-violet-200">
                      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-violet-600 tracking-wider">Customer pays</span><span className="text-base font-black text-violet-700">${calculateCustomerPrice(formData.price)}</span></div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">{showShopSelector ? 'Shop receives' : 'You receive'}</span><span className="text-base font-black text-emerald-700">${calculateShopRevenue(formData.price)}</span></div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="discount_price" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Sale Price (optional)</Label>
                <div className="relative mt-1.5">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="discount_price" type="number" step="0.01" min="0" value={formData.discount_price} onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })} placeholder="0.00" className="text-base font-bold pl-9 h-11 rounded-xl border-slate-200 focus:border-emerald-400" />
                </div>
                {formData.discount_price && parseFloat(formData.discount_price) > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Customer pays</span><span className="text-base font-black text-emerald-700">${calculateCustomerPrice(formData.discount_price)}</span></div>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">{showShopSelector ? 'Shop receives' : 'You receive'}</span><span className="text-base font-black text-emerald-700">${calculateShopRevenue(formData.discount_price)}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="stock" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock Quantity *</Label>
              <div className="relative mt-1.5 max-w-xs">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input id="stock" type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} placeholder="0" required className="text-base font-bold pl-9 h-11 rounded-xl border-slate-200" data-testid="product-stock-input" />
              </div>
            </div>
          </section>
        )}

        {/* === STEP 5: IMAGES === */}
        <section className="rounded-2xl border-2 border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">{enabledVariantCount > 0 ? '4' : '5'}</div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{enabledVariantCount > 0 ? 'Additional Images' : 'Product Images'}</h3>
          </div>
          <MultiImageUploader images={formData.images} onChange={(urls) => setFormData({ ...formData, images: urls })} />
        </section>

        {/* Submit row */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 -mx-6 px-6 py-4 flex gap-3 z-10">
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
          <Button type="submit" className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 hover:from-violet-700 hover:via-fuchsia-700 hover:to-rose-600 text-white font-bold shadow-lg shadow-violet-500/25" data-testid="submit-product-btn">
            {editingProduct ? 'Update Product' : 'Create Product'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};

export default ProductFormDialog;
