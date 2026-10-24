import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Plus, Upload, Link as LinkIcon, Trash2, Edit, X, ArrowLeft, ChevronUp, ChevronDown, Move, Sparkles, Camera, Save, ArrowUp, ArrowDown, GripVertical, ZoomIn, Eye } from 'lucide-react';
import ShopLayout from '../../components/ShopLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const ShopGallery = () => {
  const navigate = useNavigate();
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlCaption, setUrlCaption] = useState('');
  const [editing, setEditing] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [dragId, setDragId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchGallery(); }, []);

  const fetchGallery = async () => {
    setLoading(true);
    try { const { data } = await api.shop.getGallery(); setGallery(data.gallery || []); }
    catch { toast.error('Failed to load gallery'); }
    finally { setLoading(false); }
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploads = [];
      for (const f of files) {
        try {
          const { data } = await api.shop.uploadFile(f);
          if (data && data.url) uploads.push({ url: data.url, caption: '' });
        } catch {}
      }
      if (!uploads.length) { toast.error('Upload failed'); return; }
      const { data } = await api.shop.addGalleryPhotos(uploads);
      setGallery(data.gallery || []);
      toast.success(`${uploads.length} photo${uploads.length > 1 ? 's' : ''} added`);
    } catch (err) { toast.error('Upload failed'); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUrl = async () => {
    if (!urlValue.trim()) return;
    try {
      const { data } = await api.shop.addGalleryPhotos([{ url: urlValue.trim(), caption: urlCaption.trim() }]);
      setGallery(data.gallery || []);
      toast.success('Photo added');
      setUrlValue(''); setUrlCaption(''); setUrlOpen(false);
    } catch { toast.error('Failed to add'); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      const { data } = await api.shop.deleteGalleryPhoto(confirmDel.id);
      setGallery(data.gallery || []);
      toast.success('Photo deleted');
      setConfirmDel(null);
      setLightbox(null);
    } catch { toast.error('Failed to delete'); }
  };

  const saveCaption = async () => {
    if (!editing) return;
    try {
      const { data } = await api.shop.updateGalleryPhoto(editing.id, { caption: editCaption });
      setGallery(data.gallery || []);
      toast.success('Caption updated');
      setEditing(null);
    } catch { toast.error('Failed to update'); }
  };

  const movePhoto = async (id, dir) => {
    const idx = gallery.findIndex(p => p.id === id);
    if (idx === -1) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= gallery.length) return;
    const next = [...gallery];
    [next[idx], next[target]] = [next[target], next[idx]];
    setGallery(next);
    try { await api.shop.reorderGallery(next.map(p => p.id)); }
    catch { toast.error('Failed to reorder'); fetchGallery(); }
  };

  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = async (targetId) => {
    if (!dragId || dragId === targetId) return;
    const fromIdx = gallery.findIndex(p => p.id === dragId);
    const toIdx = gallery.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...gallery];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setGallery(next);
    setDragId(null);
    try { await api.shop.reorderGallery(next.map(p => p.id)); toast.success('Order saved'); }
    catch { toast.error('Failed to reorder'); fetchGallery(); }
  };

  // Lightbox helpers
  const nextL = () => { if (!lightbox) return; const i = (lightbox.idx + 1) % gallery.length; setLightbox({ photo: gallery[i], idx: i }); };
  const prevL = () => { if (!lightbox) return; const i = (lightbox.idx - 1 + gallery.length) % gallery.length; setLightbox({ photo: gallery[i], idx: i }); };

  return (
    <ShopLayout>
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 sm:p-8 mb-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
          <div className="relative">
            <button onClick={() => navigate('/shop/dashboard')} className="inline-flex items-center gap-1 text-white/85 text-xs mb-2 hover:text-white"><ArrowLeft className="w-3.5 h-3.5"/>Back to Dashboard</button>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5"/><span>My Gallery</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Shop Gallery</h1>
                <p className="text-white/85 text-sm">{gallery.length} photo{gallery.length !== 1 ? 's' : ''} · Drag to reorder · Click to view</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFiles} data-testid="gallery-file-input" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-white text-emerald-700 hover:bg-white/90 font-semibold" data-testid="gallery-upload-btn">
                  <Camera className="w-4 h-4 mr-2"/>{uploading ? 'Uploading...' : 'Upload Photos'}
                </Button>
                <Button variant="secondary" onClick={() => setUrlOpen(true)} className="bg-white/15 text-white hover:bg-white/25 border-0" data-testid="gallery-url-btn">
                  <LinkIcon className="w-4 h-4 mr-2"/>Add by URL
                </Button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading...</div>
        ) : gallery.length === 0 ? (
          <div className="py-16 sm:py-20 text-center bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-3xl border-2 border-dashed border-emerald-200">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center mb-4 shadow-lg">
              <ImageIcon className="w-10 h-10" />
            </div>
            <div className="text-xl font-bold text-slate-800 mb-1">Your gallery is empty</div>
            <div className="text-sm text-slate-500 mb-6">Show off your shop with beautiful photos.</div>
            <Button onClick={() => fileInputRef.current?.click()} className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white"><Plus className="w-4 h-4 mr-1"/>Add your first photo</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" data-testid="shop-gallery-grid">
            {gallery.map((p, idx) => {
              const heights = ['h-44', 'h-56', 'h-48', 'h-64', 'h-52'];
              const h = heights[idx % heights.length];
              return (
                <div key={p.id} draggable onDragStart={() => onDragStart(p.id)} onDragOver={onDragOver} onDrop={() => onDrop(p.id)}
                  className={`group relative ${h} bg-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-grab active:cursor-grabbing ${dragId === p.id ? 'opacity-50 ring-2 ring-emerald-400' : ''}`}
                  data-testid={`gallery-photo-${p.id}`}>
                  <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onClick={() => setLightbox({ photo: p, idx })} />
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"><GripVertical className="w-3 h-3"/>#{idx + 1}</div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      <button onClick={(e) => { e.stopPropagation(); movePhoto(p.id, 'up'); }} disabled={idx === 0} className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white disabled:opacity-30 flex items-center justify-center" title="Move up"><ArrowUp className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); movePhoto(p.id, 'down'); }} disabled={idx === gallery.length - 1} className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white disabled:opacity-30 flex items-center justify-center" title="Move down"><ArrowDown className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); setEditing(p); setEditCaption(p.caption || ''); }} className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center" title="Edit caption"><Edit className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); setLightbox({ photo: p, idx }); }} className="w-7 h-7 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center" title="View"><ZoomIn className="w-3.5 h-3.5"/></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDel(p); }} className="w-7 h-7 rounded-md bg-red-500/70 hover:bg-red-500 text-white flex items-center justify-center ml-auto" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                    {p.caption && <div className="text-[11px] text-white line-clamp-2">{p.caption}</div>}
                  </div>
                </div>
              );
            })}
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 h-44 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 transition-all" data-testid="gallery-add-tile">
              <Plus className="w-6 h-6"/>
              <span className="text-xs font-semibold">Add more</span>
            </button>
          </div>
        )}
      </div>

      {/* Add by URL dialog */}
      <Dialog open={urlOpen} onOpenChange={setUrlOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Photo by URL</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div><Label>Image URL</Label><Input value={urlValue} onChange={e => setUrlValue(e.target.value)} placeholder="https://..." data-testid="url-input"/></div>
            <div><Label>Caption (optional)</Label><Input value={urlCaption} onChange={e => setUrlCaption(e.target.value)} placeholder="Describe this photo"/></div>
            {urlValue && <div className="mt-2 rounded-xl overflow-hidden bg-slate-50 border"><img src={urlValue} alt="" className="w-full max-h-48 object-contain"/></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUrl} className="bg-emerald-600 text-white" data-testid="url-save">Add Photo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit caption */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit caption</DialogTitle></DialogHeader>
          {editing && <img src={editing.url} alt="" className="rounded-xl max-h-48 object-contain mx-auto bg-slate-50"/>}
          <div><Label>Caption</Label><Input value={editCaption} onChange={e => setEditCaption(e.target.value)} placeholder="Add a caption..."/></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveCaption} className="bg-emerald-600 text-white"><Save className="w-4 h-4 mr-1"/>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 bg-slate-950 border-none">
          {lightbox && (
            <div className="relative">
              <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                <button onClick={() => { setEditing(lightbox.photo); setEditCaption(lightbox.photo.caption || ''); setLightbox(null); }} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20" title="Edit caption"><Edit className="w-4 h-4"/></button>
                <button onClick={() => setConfirmDel(lightbox.photo)} className="p-1.5 rounded-lg bg-red-500/30 text-red-200 hover:bg-red-500/50" title="Delete"><Trash2 className="w-4 h-4"/></button>
                <button onClick={() => setLightbox(null)} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-4 h-4"/></button>
              </div>
              <img src={lightbox.photo.url} alt={lightbox.photo.caption || ''} className="w-full max-h-[80vh] object-contain"/>
              {lightbox.photo.caption && <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-sm">{lightbox.photo.caption}</div>}
              {gallery.length > 1 && (
                <>
                  <button onClick={prevL} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center">←</button>
                  <button onClick={nextL} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center">→</button>
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
            <AlertDialogDescription>Remove this photo from your gallery? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShopLayout>
  );
};

export default ShopGallery;
