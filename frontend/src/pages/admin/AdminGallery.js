import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Store, Trash2, Search, Filter, Eye, X, ChevronLeft, ChevronRight, Download, ExternalLink, Grid3x3, LayoutGrid, RefreshCw, CheckCircle2, Clock, Ban, ShieldCheck } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import AgentLayout from '../../components/AgentLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const Gallery = ({ asAgent = false }) => {
  const Layout = asAgent ? AgentLayout : AdminLayout;
  const layoutProps = asAgent ? { requirePage: 'gallery' } : {};
  const navigate = useNavigate();
  const [data, setData] = useState({ shops: [], total_shops: 0, total_photos: 0, approved_count: 0, pending_count: 0, suspended_count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // shop status filter
  const [photoStatusFilter, setPhotoStatusFilter] = useState('all'); // photo moderation status
  const [expanded, setExpanded] = useState({}); // shop_id -> bool
  const [layout, setLayout] = useState('mosaic'); // mosaic | grid
  const [lightbox, setLightbox] = useState(null); // {shop, photo, idx}
  const [confirmDel, setConfirmDel] = useState(null); // {shop_id, photo}

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try { const { data } = await api.admin.getAllGallery(); setData(data); }
    catch { toast.error('Failed to load gallery'); }
    finally { setLoading(false); }
  };

  // Filter shops AND filter photos per shop based on photoStatusFilter
  const filtered = useMemo(() => {
    return (data.shops || [])
      .map((s) => {
        let gallery = s.gallery;
        if (photoStatusFilter !== 'all') {
          gallery = (s.gallery || []).filter((p) => (p.status || 'pending') === photoStatusFilter);
        }
        return { ...s, gallery, photo_count: gallery.length };
      })
      .filter((s) => {
        if (statusFilter !== 'all' && s.shop_status !== statusFilter) return false;
        if (photoStatusFilter !== 'all' && s.photo_count === 0) return false;
        if (!search.trim()) return true;
        return (s.shop_name || '').toLowerCase().includes(search.toLowerCase());
      });
  }, [data, search, statusFilter, photoStatusFilter]);

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await api.admin.deleteShopGalleryPhoto(confirmDel.shop_id, confirmDel.photo.id);
      toast.success('Photo deleted');
      setConfirmDel(null);
      setLightbox(null);
      await fetchAll();
    } catch { toast.error('Failed to delete photo'); }
  };

  const handleSetStatus = async (shop_id, photo, newStatus) => {
    try {
      await api.admin.setGalleryPhotoStatus(shop_id, photo.id, newStatus);
      toast.success(`Photo ${newStatus}`);
      setData((d) => ({
        ...d,
        shops: (d.shops || []).map((s) =>
          s.shop_id === shop_id
            ? { ...s, gallery: s.gallery.map((p) => (p.id === photo.id ? { ...p, status: newStatus } : p)) }
            : s
        ),
      }));
      if (lightbox && lightbox.photo?.id === photo.id) {
        setLightbox({ ...lightbox, photo: { ...lightbox.photo, status: newStatus } });
      }
    } catch { toast.error('Failed to update status'); }
  };

  const nextPhoto = () => {
    if (!lightbox) return;
    const shop = data.shops.find(s => s.shop_id === lightbox.shop.shop_id);
    if (!shop) return;
    const idx = (lightbox.idx + 1) % shop.gallery.length;
    setLightbox({ shop, photo: shop.gallery[idx], idx });
  };
  const prevPhoto = () => {
    if (!lightbox) return;
    const shop = data.shops.find(s => s.shop_id === lightbox.shop.shop_id);
    if (!shop) return;
    const idx = (lightbox.idx - 1 + shop.gallery.length) % shop.gallery.length;
    setLightbox({ shop, photo: shop.gallery[idx], idx });
  };

  const statusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved') return { Ic: CheckCircle2, label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (s === 'suspended') return { Ic: Ban, label: 'Suspended', cls: 'bg-red-100 text-red-700 border-red-200' };
    return { Ic: Clock, label: 'Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  };

  return (
    <Layout {...layoutProps}>
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-600 via-rose-600 to-fuchsia-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3">
                <ImageIcon className="w-3.5 h-3.5" /><span>Gallery Moderation</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">All Shops Gallery</h1>
              <p className="text-white/85 text-sm">{data.total_shops} shops · {data.total_photos} photos</p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/25 backdrop-blur-sm border border-emerald-300/30 text-white text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" /> {data.approved_count || 0} approved
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/25 backdrop-blur-sm border border-amber-300/30 text-white text-[11px] font-bold">
                  <Clock className="w-3 h-3" /> {data.pending_count || 0} pending
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-400/25 backdrop-blur-sm border border-red-300/30 text-white text-[11px] font-bold">
                  <Ban className="w-3 h-3" /> {data.suspended_count || 0} suspended
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={fetchAll} className="bg-white/15 text-white hover:bg-white/25 border-0"><RefreshCw className="w-4 h-4 mr-2"/>Refresh</Button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-3 sm:p-4 mb-5 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input className="flex-1 bg-transparent outline-none text-sm" placeholder="Search shops by name" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Photo moderation status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Photo:</span>
            {[
              { key: 'all', label: 'All', Ic: ImageIcon, cls: 'bg-slate-700 text-white' },
              { key: 'approved', label: 'Approved', Ic: CheckCircle2, cls: 'bg-emerald-600 text-white' },
              { key: 'pending', label: 'Pending', Ic: Clock, cls: 'bg-amber-500 text-white' },
              { key: 'suspended', label: 'Suspended', Ic: Ban, cls: 'bg-red-500 text-white' },
            ].map((opt) => {
              const Ic = opt.Ic;
              const active = photoStatusFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setPhotoStatusFilter(opt.key)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition flex items-center gap-1 ${active ? opt.cls + ' shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  data-testid={`photo-status-filter-${opt.key}`}
                >
                  <Ic className="w-3 h-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Shop status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">Shop:</span>
            {['all', 'approved', 'pending', 'suspended'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${statusFilter === s ? 'bg-pink-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setLayout('mosaic')} className={`p-1.5 rounded-md ${layout === 'mosaic' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setLayout('grid')} className={`p-1.5 rounded-md ${layout === 'grid' ? 'bg-white shadow text-pink-600' : 'text-slate-500'}`}><Grid3x3 className="w-4 h-4" /></button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <div className="font-semibold text-slate-700">No galleries to show</div>
            <div className="text-sm text-slate-500">No photos match the selected filters.</div>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map(shop => {
              const isOpen = expanded[shop.shop_id] !== false;
              const photos = isOpen ? shop.gallery : shop.gallery.slice(0, 8);
              return (
                <div key={shop.shop_id} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden" data-testid={`shop-gallery-${shop.shop_id}`}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-pink-50/40 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      {shop.shop_logo ? (
                        <img src={shop.shop_logo} alt="" className="w-10 h-10 rounded-xl object-cover ring-2 ring-pink-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 text-white flex items-center justify-center font-bold">{(shop.shop_name || '?').charAt(0)}</div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate flex items-center gap-2">{shop.shop_name}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${shop.shop_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : shop.shop_status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{shop.shop_status}</span>
                        </div>
                        <div className="text-xs text-slate-500">{shop.photo_count} photo{shop.photo_count !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/shop/${shop.shop_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 hover:bg-slate-50"><ExternalLink className="w-3.5 h-3.5"/>View Shop</a>
                      {shop.gallery.length > 8 && (
                        <Button size="sm" variant="outline" onClick={() => setExpanded(e => ({ ...e, [shop.shop_id]: !isOpen }))}>{isOpen ? 'Collapse' : `Show All (${shop.gallery.length})`}</Button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    {layout === 'mosaic' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {photos.map((photo, i) => {
                          const heights = ['h-32', 'h-44', 'h-36', 'h-52', 'h-40'];
                          const h = heights[i % heights.length];
                          const sb = statusBadge(photo.status);
                          const SI = sb.Ic;
                          return (
                            <div key={photo.id} className={`group relative rounded-xl overflow-hidden bg-slate-100 ${h} hover:shadow-lg transition-shadow`} data-testid={`gallery-photo-${photo.id}`}>
                              <button onClick={() => setLightbox({ shop, photo, idx: shop.gallery.indexOf(photo) })} className="block w-full h-full">
                                <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                              <span className={`absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${sb.cls} backdrop-blur-sm pointer-events-none`}>
                                <SI className="w-2.5 h-2.5" />
                                {sb.label}
                              </span>
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {photo.status !== 'approved' && (
                                  <button onClick={(e) => { e.stopPropagation(); handleSetStatus(shop.shop_id, photo, 'approved'); }} className="flex-1 inline-flex items-center justify-center px-1.5 py-1 rounded-md bg-emerald-500/95 text-white text-[10px] font-bold shadow hover:bg-emerald-600" data-testid={`approve-photo-${photo.id}`} title="Approve">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </button>
                                )}
                                {photo.status !== 'pending' && (
                                  <button onClick={(e) => { e.stopPropagation(); handleSetStatus(shop.shop_id, photo, 'pending'); }} className="flex-1 inline-flex items-center justify-center px-1.5 py-1 rounded-md bg-amber-500/95 text-white text-[10px] font-bold shadow hover:bg-amber-600" title="Mark pending">
                                    <Clock className="w-3 h-3" />
                                  </button>
                                )}
                                {photo.status !== 'suspended' && (
                                  <button onClick={(e) => { e.stopPropagation(); handleSetStatus(shop.shop_id, photo, 'suspended'); }} className="flex-1 inline-flex items-center justify-center px-1.5 py-1 rounded-md bg-red-500/95 text-white text-[10px] font-bold shadow hover:bg-red-600" data-testid={`suspend-photo-${photo.id}`} title="Suspend">
                                    <Ban className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {photos.map(photo => {
                          const sb = statusBadge(photo.status);
                          const SI = sb.Ic;
                          return (
                            <div key={photo.id} className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                              <button onClick={() => setLightbox({ shop, photo, idx: shop.gallery.indexOf(photo) })} className="block w-full h-full">
                                <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy"/>
                              </button>
                              <span className={`absolute top-1 left-1 inline-flex items-center px-1 py-0.5 rounded-full text-[8px] font-bold border ${sb.cls} pointer-events-none`}>
                                <SI className="w-2 h-2 mr-0.5" />
                                {sb.label.charAt(0)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-950 border-none">
          {lightbox && (
            <div className="relative bg-slate-950">
              <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  {lightbox.shop.shop_logo && <img src={lightbox.shop.shop_logo} alt="" className="w-8 h-8 rounded-lg object-cover"/>}
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-2">
                      {lightbox.shop.shop_name}
                      {(() => {
                        const sb = statusBadge(lightbox.photo?.status);
                        const SI = sb.Ic;
                        return (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${sb.cls}`}>
                            <SI className="w-2.5 h-2.5" />
                            {sb.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-white/60">Photo {lightbox.idx + 1} / {lightbox.shop.gallery.length}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSetStatus(lightbox.shop.shop_id, lightbox.photo, 'approved')} className="px-2 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/40 flex items-center gap-1" data-testid={`lightbox-approve-${lightbox.photo.id}`}><CheckCircle2 className="w-3.5 h-3.5"/>Approve</button>
                  <button onClick={() => handleSetStatus(lightbox.shop.shop_id, lightbox.photo, 'suspended')} className="px-2 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/40 flex items-center gap-1"><Ban className="w-3.5 h-3.5"/>Suspend</button>
                  <a href={lightbox.photo.url} target="_blank" rel="noreferrer" className="px-2 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Open</a>
                  <button onClick={() => setConfirmDel({ shop_id: lightbox.shop.shop_id, photo: lightbox.photo })} className="px-2 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs hover:bg-red-500/40 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/>Delete</button>
                  <button onClick={() => setLightbox(null)} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-4 h-4"/></button>
                </div>
              </div>
              <img src={lightbox.photo.url} alt={lightbox.photo.caption || ''} className="w-full max-h-[80vh] object-contain" />
              {lightbox.photo.caption && <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-sm">{lightbox.photo.caption}</div>}
              {lightbox.shop.gallery.length > 1 && (
                <>
                  <button onClick={prevPhoto} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center"><ChevronLeft className="w-5 h-5"/></button>
                  <button onClick={nextPhoto} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center"><ChevronRight className="w-5 h-5"/></button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete photo</AlertDialogTitle>
            <AlertDialogDescription>Remove this photo from the shop&apos;s gallery? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Gallery;
