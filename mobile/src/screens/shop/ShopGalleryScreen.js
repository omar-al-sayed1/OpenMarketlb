import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Image, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickImage } from '../../lib/imagePick';
import Animated, { LinearTransition, FadeIn, ZoomOut } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { tapLight, notifySuccess } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { ShopScreenWrap, Rise, PressScale, Spinner, toast } from '../../components/shop/ShopKit';

const W = Dimensions.get('window').width;
const HEIGHTS = [176, 224, 192, 256, 208]; // the web's h-44/h-56/h-48/h-64/h-52 masonry rhythm

export default function ShopGalleryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlCaption, setUrlCaption] = useState('');
  const [editing, setEditing] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [liftedId, setLiftedId] = useState(null); // pressed tile lifts with a shadow

  const fetchGallery = useCallback(async () => {
    try { const { data } = await api.shop.getGallery(); setGallery(data.gallery || []); }
    catch { toast.error('Failed to load gallery'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchGallery(); }, [fetchGallery]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchGallery(); setRefreshing(false); }, [fetchGallery]);

  /* multi-photo upload via the native picker */
  const handleUpload = async () => {
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.85, allowsMultipleSelection: true });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      const uploads = [];
      for (const asset of res.assets) {
        try {
          const { data } = await api.shop.uploadFile({ uri: asset.uri, name: asset.fileName || 'photo.jpg', mimeType: asset.mimeType });
          if (data && data.url) uploads.push({ url: data.url, caption: '' });
        } catch {}
      }
      if (!uploads.length) { toast.error('Upload failed'); return; }
      const { data } = await api.shop.addGalleryPhotos(uploads);
      setGallery(data.gallery || []);
      notifySuccess();
      toast.success(`${uploads.length} photo${uploads.length > 1 ? 's' : ''} added`);
    } catch (err) { toast.error('Upload failed'); }
    finally { setUploading(false); }
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

  /* reorder — grid re-flows with a spring; the moved tile lifts */
  const movePhoto = async (id, dir) => {
    const idx = gallery.findIndex(p => p.id === id);
    if (idx === -1) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= gallery.length) return;
    tapLight();
    setLiftedId(id);
    setTimeout(() => setLiftedId(null), 600);
    const next = [...gallery];
    [next[idx], next[target]] = [next[target], next[idx]];
    setGallery(next);
    try { await api.shop.reorderGallery(next.map(p => p.id)); toast.success('Order saved'); }
    catch { toast.error('Failed to reorder'); fetchGallery(); }
  };

  const nextL = () => { if (!lightbox) return; const i = (lightbox.idx + 1) % gallery.length; setLightbox({ photo: gallery[i], idx: i }); };
  const prevL = () => { if (!lightbox) return; const i = (lightbox.idx - 1 + gallery.length) % gallery.length; setLightbox({ photo: gallery[i], idx: i }); };

  if (loading) {
    return <View style={st.center}><Spinner size={34} color="#059669" /></View>;
  }

  return (
    <>
    <ShopScreenWrap refreshing={refreshing} onRefresh={onRefresh}>
      {/* Hero — emerald-500 -> teal-500 -> cyan-600 */}
      <Rise duration={500} distance={0}>
        <LinearGradient colors={['#10b981', '#14b8a6', '#0891b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
          <View style={[st.blob, { top: -48, right: -48 }]} />
          <View style={[st.blob, { bottom: -64, left: -64, width: 220, height: 220, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <TouchableOpacity onPress={() => navigation.navigate('ShopHome')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            <Ionicons name="arrow-back" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={st.backText}>Back to Dashboard</Text>
          </TouchableOpacity>
          <View style={st.heroTag}><Ionicons name="sparkles" size={12} color={colors.white} /><Text style={st.heroTagText}>My Gallery</Text></View>
          <Text style={st.heroTitle}>Shop Gallery</Text>
          <Text style={st.heroSub}>{gallery.length} photo{gallery.length !== 1 ? 's' : ''} · Reorder with the arrows · Tap to view</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <PressScale onPress={handleUpload} disabled={uploading}>
              <View style={st.whiteBtn} testID="gallery-upload-btn">
                {uploading ? <Spinner size={14} color="#047857" /> : <Ionicons name="camera" size={14} color="#047857" />}
                <Text style={st.whiteBtnText}>{uploading ? 'Uploading...' : 'Upload Photos'}</Text>
              </View>
            </PressScale>
            <PressScale onPress={() => setUrlOpen(true)}>
              <View style={st.ghostBtn} testID="gallery-url-btn">
                <Ionicons name="link" size={14} color={colors.white} />
                <Text style={st.ghostBtnText}>Add by URL</Text>
              </View>
            </PressScale>
          </View>
        </LinearGradient>
      </Rise>

      {gallery.length === 0 ? (
        <Rise delay={120}>
          <View style={st.empty}>
            <LinearGradient colors={['#10b981', '#14b8a6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.emptyIcon}>
              <Ionicons name="images" size={34} color={colors.white} />
            </LinearGradient>
            <Text style={st.emptyTitle}>Your gallery is empty</Text>
            <Text style={st.emptyDesc}>Show off your shop with beautiful photos.</Text>
            <PressScale onPress={handleUpload} style={{ marginTop: 14 }}>
              <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.emeraldBtn}>
                <Ionicons name="add" size={15} color={colors.white} />
                <Text style={st.emeraldText}>Add your first photo</Text>
              </LinearGradient>
            </PressScale>
          </View>
        </Rise>
      ) : (
        <View style={st.grid} testID="shop-gallery-grid">
          {gallery.map((p, idx) => {
            const h = HEIGHTS[idx % HEIGHTS.length];
            const lifted = liftedId === p.id;
            return (
              <Animated.View key={p.id} layout={LinearTransition.springify().damping(16)} entering={FadeIn} exiting={ZoomOut.duration(320)}
                style={[st.tileWrap, lifted && st.lifted]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setLightbox({ photo: p, idx })} testID={`gallery-photo-${p.id}`}>
                  <View style={[st.tile, { height: h }]}>
                    <Image source={{ uri: img(p.url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    {/* index chip */}
                    <View style={st.idxChip}>
                      <Ionicons name="reorder-two" size={10} color={colors.white} />
                      <Text style={st.idxText}>#{idx + 1}</Text>
                    </View>
                    {/* bottom controls */}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.8)']} style={st.tileFoot}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <TouchableOpacity onPress={() => movePhoto(p.id, 'up')} disabled={idx === 0} style={[st.tileBtn, idx === 0 && { opacity: 0.3 }]}>
                          <Ionicons name="arrow-up" size={13} color={colors.white} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => movePhoto(p.id, 'down')} disabled={idx === gallery.length - 1} style={[st.tileBtn, idx === gallery.length - 1 && { opacity: 0.3 }]}>
                          <Ionicons name="arrow-down" size={13} color={colors.white} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditing(p); setEditCaption(p.caption || ''); }} style={st.tileBtn}>
                          <Ionicons name="create" size={13} color={colors.white} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={() => setConfirmDel(p)} style={[st.tileBtn, { backgroundColor: 'rgba(239,68,68,0.75)' }]}>
                          <Ionicons name="trash" size={13} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                      {p.caption ? <Text style={st.tileCaption} numberOfLines={2}>{p.caption}</Text> : null}
                    </LinearGradient>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          {/* add tile */}
          <View style={st.tileWrap}>
            <TouchableOpacity onPress={handleUpload} activeOpacity={0.8} style={st.addTile} testID="gallery-add-tile">
              <Ionicons name="add" size={24} color="#047857" />
              <Text style={st.addTileText}>Add more</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ShopScreenWrap>

    {/* Add by URL */}
    <Modal visible={urlOpen} transparent animationType="fade" onRequestClose={() => setUrlOpen(false)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setUrlOpen(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <Text style={st.dialogTitle}>Add Photo by URL</Text>
            <Text style={st.label}>Image URL</Text>
            <TextInput value={urlValue} onChangeText={setUrlValue} placeholder="https://..." autoCapitalize="none"
              placeholderTextColor={colors.textMuted} style={st.input} testID="url-input" />
            <Text style={st.label}>Caption (optional)</Text>
            <TextInput value={urlCaption} onChangeText={setUrlCaption} placeholder="Describe this photo"
              placeholderTextColor={colors.textMuted} style={st.input} />
            {urlValue ? (
              <View style={st.urlPreview}><Image source={{ uri: img(urlValue) }} style={{ width: '100%', height: 150 }} resizeMode="contain" /></View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PressScale style={{ flex: 1 }} onPress={() => setUrlOpen(false)}>
                <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
              </PressScale>
              <PressScale style={{ flex: 1 }} onPress={handleAddUrl}>
                <View style={[st.emeraldBtn, { height: 44 }]} testID="url-save"><Text style={st.emeraldText}>Add Photo</Text></View>
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>

    {/* Edit caption */}
    <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditing(null)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.dialog}>
            <Text style={st.dialogTitle}>Edit caption</Text>
            {editing ? <View style={st.urlPreview}><Image source={{ uri: img(editing.url) }} style={{ width: '100%', height: 150 }} resizeMode="contain" /></View> : null}
            <Text style={st.label}>Caption</Text>
            <TextInput value={editCaption} onChangeText={setEditCaption} placeholder="Add a caption..."
              placeholderTextColor={colors.textMuted} style={st.input} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <PressScale style={{ flex: 1 }} onPress={() => setEditing(null)}>
                <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
              </PressScale>
              <PressScale style={{ flex: 1 }} onPress={saveCaption}>
                <View style={[st.emeraldBtn, { height: 44 }]}><Ionicons name="save" size={13} color={colors.white} /><Text style={st.emeraldText}>Save</Text></View>
              </PressScale>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>

    {/* Lightbox */}
    <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
      <View style={st.lightbox}>
        {lightbox && (
          <>
            <View style={[st.lightboxTop, { top: insets.top + 10 }]}>
              <TouchableOpacity onPress={() => { setEditing(lightbox.photo); setEditCaption(lightbox.photo.caption || ''); setLightbox(null); }} style={st.lbBtn}>
                <Ionicons name="create" size={16} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmDel(lightbox.photo)} style={[st.lbBtn, { backgroundColor: 'rgba(239,68,68,0.4)' }]}>
                <Ionicons name="trash" size={16} color="#fecaca" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLightbox(null)} style={st.lbBtn}>
                <Ionicons name="close" size={17} color={colors.white} />
              </TouchableOpacity>
            </View>
            <Image source={{ uri: img(lightbox.photo.url) }} style={{ width: W, height: '70%' }} resizeMode="contain" />
            {lightbox.photo.caption ? (
              <View style={st.lbCaption}><Text style={st.lbCaptionText}>{lightbox.photo.caption}</Text></View>
            ) : null}
            {gallery.length > 1 && (
              <>
                <TouchableOpacity onPress={prevL} style={[st.lbNav, { left: 12 }]}><Ionicons name="chevron-back" size={22} color={colors.white} /></TouchableOpacity>
                <TouchableOpacity onPress={nextL} style={[st.lbNav, { right: 12 }]}><Ionicons name="chevron-forward" size={22} color={colors.white} /></TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </Modal>

    {/* Delete confirm */}
    <Modal visible={!!confirmDel} transparent animationType="fade" onRequestClose={() => setConfirmDel(null)}>
      <BlurView intensity={24} tint="dark" style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setConfirmDel(null)} />
        <View style={st.dialog}>
          <Text style={st.dialogTitle}>Delete photo</Text>
          <Text style={st.deleteDesc}>Remove this photo from your gallery? This cannot be undone.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <PressScale style={{ flex: 1 }} onPress={() => setConfirmDel(null)}>
              <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
            </PressScale>
            <PressScale style={{ flex: 1 }} onPress={handleDelete}>
              <View style={st.redBtn}><Text style={st.emeraldText}>Delete</Text></View>
            </PressScale>
          </View>
        </View>
      </BlurView>
    </Modal>
    </>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: shop.bg },
  hero: { borderRadius: radius.xxl, padding: 20, overflow: 'hidden', ...shadow.emphasis },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.1)' },
  backText: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 11.5 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 9 },
  heroTagText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 11.5 },
  heroTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 25, letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  whiteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, ...shadow.card },
  whiteBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#047857' },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10 },
  ghostBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  empty: { alignItems: 'center', backgroundColor: '#f0fdfa', borderRadius: radius.xxl, borderWidth: 2, borderStyle: 'dashed', borderColor: '#a7f3d0', paddingVertical: 44, paddingHorizontal: 24, marginTop: 14 },
  emptyIcon: { width: 76, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...shadow.emphasis },
  emptyTitle: { fontFamily: fonts.extrabold, fontSize: 18.5, color: colors.ink },
  emptyDesc: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 3 },
  emeraldBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#059669', ...shop.emeraldGlow },
  emeraldText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  tileWrap: { flexBasis: '47%', flexGrow: 1 },
  lifted: { transform: [{ scale: 1.04 }], zIndex: 5, ...shadow.dropdown },
  tile: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.borderLight, ...shadow.card },
  idxChip: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2.5 },
  idxText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 9 },
  tileFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, paddingTop: 22 },
  tileBtn: { width: 27, height: 27, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  tileCaption: { color: colors.white, fontFamily: fonts.body, fontSize: 10.5, marginTop: 5 },
  addTile: { height: 176, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: '#a7f3d0', backgroundColor: 'rgba(236,253,245,0.4)', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addTileText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#047857' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, ...shadow.dropdown },
  dialogTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.ink, marginBottom: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  urlPreview: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, marginTop: 10 },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  redBtn: { height: 44, borderRadius: radius.md, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  deleteDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  lightbox: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' },
  lightboxTop: { position: 'absolute', right: 14, zIndex: 10, flexDirection: 'row', gap: 8 },
  lbBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  lbCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, backgroundColor: 'rgba(0,0,0,0.55)' },
  lbCaptionText: { color: colors.white, fontFamily: fonts.body, fontSize: 13 },
  lbNav: { position: 'absolute', top: '50%', width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});
