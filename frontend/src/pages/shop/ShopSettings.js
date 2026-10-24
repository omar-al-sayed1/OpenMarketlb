import React, { useEffect, useState } from 'react';
import { Store, CreditCard, Loader2, AlertTriangle, ImagePlus, Image as ImageIcon, GripVertical, Trash2, Pencil, Save, Mail, Phone, MapPin, FileText, Sparkles, Camera, Layers, X } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageUploader from '../../components/ImageUploader';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const ShopSettings = () => {
  const [shop, setShop] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    address: '',
    logo: '',
    banner: ''
  });

  // Gallery state
  const [gallery, setGallery] = useState([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryEditOpen, setGalleryEditOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [editingSaving, setEditingSaving] = useState(false);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    fetchData();
    fetchGallery();
  }, []);

  const fetchData = async () => {
    try {
      const [shopRes, subRes] = await Promise.all([
        api.shop.getProfile(),
        api.shop.getSubscription()
      ]);
      setShop(shopRes.data);
      setSubscription(subRes.data);
      setFormData({
        name: shopRes.data.name || '',
        description: shopRes.data.description || '',
        phone: shopRes.data.phone || '',
        email: shopRes.data.email || '',
        address: shopRes.data.address || '',
        logo: shopRes.data.logo || '',
        banner: shopRes.data.banner || ''
      });
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGallery = async () => {
    try {
      const { data } = await api.shop.getGallery();
      setGallery(data.gallery || []);
    } catch (error) {
      console.error('Failed to fetch gallery', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.shop.updateProfile(formData);
      toast.success('Settings saved successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const { data } = await api.shop.subscribe('stripe', 1);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      await api.shop.cancelSubscription();
      toast.success('Subscription cancelled successfully');
      setCancelDialogOpen(false);
      window.location.href = '/';
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  // ============ GALLERY HANDLERS ============
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setGalleryUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10MB limit, skipping`);
          continue;
        }
        try {
          const resp = await api.shop.uploadFile(file);
          const url = `${BACKEND_URL}${resp.data.url}`;
          uploaded.push({ url, caption: '' });
        } catch (err) {
          console.error('Upload failed', err);
        }
      }
      if (uploaded.length === 0) {
        toast.error('No photos uploaded');
        return;
      }
      const { data } = await api.shop.addGalleryPhotos(uploaded);
      setGallery(data.gallery || []);
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} added to gallery`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photos');
    } finally {
      setGalleryUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleAddGalleryByUrl = async () => {
    const url = window.prompt('Paste an image URL to add to your gallery:');
    if (!url || !url.trim()) return;
    try {
      const { data } = await api.shop.addGalleryPhotos([{ url: url.trim(), caption: '' }]);
      setGallery(data.gallery || []);
      toast.success('Photo added to gallery');
    } catch {
      toast.error('Failed to add photo');
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('Delete this photo from your gallery?')) return;
    try {
      const { data } = await api.shop.deleteGalleryPhoto(photoId);
      setGallery(data.gallery || []);
      toast.success('Photo deleted');
    } catch {
      toast.error('Failed to delete photo');
    }
  };

  const openEditPhoto = (photo) => {
    setEditingPhoto(photo);
    setEditCaption(photo.caption || '');
    setGalleryEditOpen(true);
  };

  const handleSaveCaption = async () => {
    if (!editingPhoto) return;
    setEditingSaving(true);
    try {
      const { data } = await api.shop.updateGalleryPhoto(editingPhoto.id, { caption: editCaption });
      setGallery(data.gallery || []);
      toast.success('Caption updated');
      setGalleryEditOpen(false);
    } catch {
      toast.error('Failed to update caption');
    } finally {
      setEditingSaving(false);
    }
  };

  // Drag-and-drop reorder
  const onDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e) => {
    e.preventDefault();
  };
  const onDrop = async (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = gallery.findIndex(p => p.id === draggedId);
    const toIdx = gallery.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...gallery];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setGallery(next);
    setDraggedId(null);
    try {
      await api.shop.reorderGallery(next.map(p => p.id));
    } catch {
      toast.error('Failed to save order');
      fetchGallery();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const sections = [
    { id: 'profile-section', label: 'Shop Profile', icon: Store, color: 'emerald' },
    { id: 'branding-section', label: 'Branding & Photos', icon: Camera, color: 'rose' },
    { id: 'gallery-section', label: 'Gallery', icon: ImageIcon, color: 'violet' },
    ...(subscription?.subscription_required !== false ? [{ id: 'subscription-section', label: 'Subscription', icon: CreditCard, color: 'amber' }] : []),
  ];

  return (
    <ShopLayout>
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 min-h-screen" data-testid="shop-settings-content">

        {/* Modern Hero Header */}
        <div className="relative overflow-hidden rounded-3xl mb-6 lg:mb-8 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 lg:p-10 shadow-xl shadow-emerald-200">
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute top-8 right-1/4 w-3 h-3 bg-white/40 rounded-full" />
          <div className="absolute bottom-10 right-1/3 w-2 h-2 bg-white/60 rounded-full" />
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <Store className="h-7 w-7 lg:h-8 lg:w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight" data-testid="shop-settings-title">Shop Settings</h1>
                <p className="text-emerald-100 text-sm mt-0.5">Customize your shop profile, branding & gallery</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full text-white/90 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> {shop?.name || 'Your Shop'}
            </div>
          </div>
        </div>

        {/* Quick Section Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`group relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:bg-${s.color}-50 hover:border-${s.color}-200 transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5`}
                data-testid={`shop-settings-nav-${s.id}`}
              >
                <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-${s.color}-100 opacity-60 group-hover:scale-125 transition-transform duration-500`} />
                <div className={`relative p-2 rounded-xl bg-${s.color}-100 group-hover:bg-${s.color}-200 group-hover:scale-110 transition-all duration-300`}>
                  <Icon className={`h-4 w-4 text-${s.color}-600`} />
                </div>
                <span className="relative text-sm font-semibold text-slate-700 group-hover:text-slate-900">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="max-w-5xl space-y-8">
          {/* Shop Profile */}
          <div id="profile-section" className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100" data-testid="shop-profile-section">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-50 to-transparent rounded-full" />
            <div className="relative flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200">
                <Store className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Shop Profile</h2>
                <p className="text-xs text-slate-500">Basic details visible to your customers</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">Shop Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5"
                  data-testid="shop-name-input"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1.5"
                  data-testid="shop-email-input"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1.5"
                  data-testid="shop-phone-input"
                />
              </div>
              <div>
                <Label htmlFor="address" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1.5"
                  data-testid="shop-address-input"
                />
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="description" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="mt-1.5"
                placeholder="Tell customers what makes your shop unique..."
                data-testid="shop-description-input"
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-200" data-testid="shop-save-profile-btn">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </div>

          {/* Branding & Photos */}
          <div id="branding-section" className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100" data-testid="shop-branding-section">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-50 to-transparent rounded-full" />
            <div className="relative flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md shadow-rose-200">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Branding & Photos</h2>
                <p className="text-xs text-slate-500">Upload your shop logo & cover photo</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                <ImageUploader
                  value={formData.logo}
                  onChange={(url) => setFormData({ ...formData, logo: url })}
                  label="Shop Logo (square, used as avatar)"
                  showUrlInput={true}
                  aspect={1}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/50">
                <ImageUploader
                  value={formData.banner}
                  onChange={(url) => setFormData({ ...formData, banner: url })}
                  label="Cover Photo (wide banner)"
                  showUrlInput={true}
                  aspect={16 / 9}
                />
                <p className="text-xs text-slate-400 mt-2">Shown on your public shop page header.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="rounded-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-md shadow-rose-200" data-testid="shop-save-branding-btn">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Branding'}
              </Button>
            </div>
          </div>

          {/* Gallery Section */}
          <div id="gallery-section" className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100" data-testid="shop-gallery-section">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-50 to-transparent rounded-full" />
            <div className="relative flex items-center justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200">
                  <ImageIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-900">Shop Gallery</h2>
                  <p className="text-xs text-slate-500">Showcase photos of your shop, products, team — visible on your public page</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200 hover:from-violet-700 hover:to-purple-700 transition-all" data-testid="gallery-upload-btn">
                  {galleryUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  {galleryUploading ? 'Uploading...' : 'Upload Photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleGalleryUpload}
                    disabled={galleryUploading}
                  />
                </label>
                <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={handleAddGalleryByUrl}>
                  Add by URL
                </Button>
              </div>
            </div>

            {gallery.length === 0 ? (
              <div className="relative text-center py-12 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/30">
                <ImageIcon className="h-12 w-12 text-violet-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">No photos in your gallery yet</p>
                <p className="text-xs text-slate-500 mb-4">Add up to dozens of photos to showcase your shop creatively</p>
                <label className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-all">
                  <ImagePlus className="h-3.5 w-3.5" /> Upload your first photo
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                </label>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-400 mb-3 inline-flex items-center gap-1.5"><GripVertical className="h-3 w-3" /> Drag & drop to reorder · click pencil to edit caption</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="gallery-grid">
                  {gallery.map((photo) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, photo.id)}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, photo.id)}
                      className={`group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 ${draggedId === photo.id ? 'opacity-50' : 'opacity-100'} cursor-move transition-all hover:shadow-md`}
                      data-testid={`gallery-item-${photo.id}`}
                    >
                      <img src={photo.url} alt={photo.caption || 'gallery'} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {/* Caption preview */}
                      {photo.caption && (
                        <div className="absolute bottom-0 inset-x-0 p-2 text-white text-[10px] line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">{photo.caption}</div>
                      )}
                      {/* Drag handle */}
                      <div className="absolute top-2 left-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-3 w-3 text-slate-600" />
                      </div>
                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditPhoto(photo)}
                          className="p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white hover:text-violet-600 transition-colors"
                          title="Edit caption"
                          data-testid={`gallery-edit-${photo.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Delete"
                          data-testid={`gallery-delete-${photo.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Subscription - hidden for shops without subscription requirement */}
          {subscription?.subscription_required !== false && (
            <div id="subscription-section" className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100" data-testid="shop-subscription-section">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-50 to-transparent rounded-full" />
              <div className="relative flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-200">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-slate-900">Subscription</h2>
                  <p className="text-xs text-slate-500">Manage your monthly plan</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-br from-slate-50 to-white">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Status</p>
                  <p className={`font-bold capitalize text-base ${
                    subscription?.subscription_status === 'active' ? 'text-emerald-600' :
                    subscription?.subscription_status === 'trial' ? 'text-blue-600' :
                    subscription?.subscription_status === 'expired' ? 'text-red-600' :
                    'text-slate-600'
                  }`}>
                    {subscription?.subscription_status || 'None'}
                  </p>
                </div>
                {subscription?.subscription_end && (
                  <div className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-br from-slate-50 to-white">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Valid Until</p>
                    <p className="font-bold text-base text-slate-800">{new Date(subscription.subscription_end).toLocaleDateString()}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 p-4 bg-gradient-to-br from-slate-50 to-white">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Price</p>
                  <p className="font-bold text-base text-slate-800">${subscription?.price || 29}<span className="text-xs text-slate-400">/month</span></p>
                </div>
              </div>
              {(subscription?.subscription_status === 'none' || subscription?.subscription_status === 'expired') && (
                <Button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="w-full sm:w-auto rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-200"
                  data-testid="shop-subscribe-btn"
                >
                  {subscribing ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</>
                  ) : (
                    <><CreditCard className="h-4 w-4 mr-2" /> Subscribe Now</>
                  )}
                </Button>
              )}
              {(subscription?.subscription_status === 'active' || subscription?.subscription_status === 'trial') && (
                <Button
                  variant="outline"
                  onClick={() => setCancelDialogOpen(true)}
                  className="w-full sm:w-auto rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  data-testid="cancel-subscription-btn"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Cancel Subscription
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Cancel Subscription Confirmation Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Cancel Subscription
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Are you sure you want to cancel your subscription? This will:
              </p>
              <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                <li>Deactivate your shop immediately</li>
                <li>Remove your seller access</li>
                <li>Your products will no longer be visible</li>
              </ul>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCancelDialogOpen(false)}
                  className="flex-1"
                  data-testid="cancel-subscription-dismiss"
                >
                  Keep Subscription
                </Button>
                <Button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  data-testid="confirm-cancel-subscription-btn"
                >
                  {cancelling ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cancelling...</>
                  ) : (
                    'Yes, Cancel'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Photo Caption Dialog */}
        <Dialog open={galleryEditOpen} onOpenChange={setGalleryEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-violet-600" /> Edit Photo Caption
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {editingPhoto && (
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <img src={editingPhoto.url} alt="" className="w-full h-48 object-cover" />
                </div>
              )}
              <div>
                <Label className="text-sm font-semibold text-slate-700">Caption (optional)</Label>
                <Textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                  placeholder="Describe this photo for your customers..."
                  data-testid="gallery-caption-input"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setGalleryEditOpen(false)} className="flex-1 rounded-full">
                  Cancel
                </Button>
                <Button onClick={handleSaveCaption} disabled={editingSaving} className="flex-1 rounded-full bg-violet-600 hover:bg-violet-700" data-testid="save-gallery-caption-btn">
                  {editingSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Caption
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ShopLayout>
  );
};

export default ShopSettings;
