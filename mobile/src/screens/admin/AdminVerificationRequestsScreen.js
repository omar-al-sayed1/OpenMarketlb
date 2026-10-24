import React, { useEffect, useState, useCallback } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { img } from '../../lib/media';
import { notifySuccess, notifyError } from '../../lib/haptics';
import { toast, Spinner } from '../../components/shop/ShopKit';
import { AdminScreen, Shimmer } from '../../components/admin/AdminKit';
import { colors, radius, fonts, shadow } from '../../theme/theme';

const fmtDate = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };
const FILTERS = [['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
const STATUS_META = { pending: ['#fef3c7', '#92400e', 'Pending Review', 'time'], approved: ['#d1fae5', '#065f46', 'Approved', 'checkmark-circle'], rejected: ['#fee2e2', '#991b1b', 'Rejected', 'close-circle'] };
const statusMeta = (s) => STATUS_META[s] || STATUS_META.pending;

function StatusBadge({ status }) {
  const [bg, fg, label, icon] = statusMeta(status);
  return <View style={[styles.badge, { backgroundColor: bg }]}><Ionicons name={icon} size={11} color={fg} /><Text style={[styles.badgeText, { color: fg }]}>{label}</Text></View>;
}

export default function AdminVerificationRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try { const { data } = await api.admin.getVerificationRequests(); setRequests(data?.requests || []); }
    catch { toast.error('Failed to load requests'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const openDetail = (r) => { setSelected(r); setRejectReason(''); };
  const approve = async (shopId) => {
    setActionLoading(true);
    try { await api.admin.approveVerification(shopId); notifySuccess(); toast.success('Verification approved! Shop is now a Verified Seller.'); setSelected(null); fetchRequests(); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed to approve'); }
    finally { setActionLoading(false); }
  };
  const reject = async (shopId) => {
    setActionLoading(true);
    try { await api.admin.rejectVerification(shopId, rejectReason || 'Does not meet requirements'); notifySuccess(); toast.success('Verification rejected.'); setSelected(null); setRejectReason(''); fetchRequests(); }
    catch (e) { notifyError(); toast.error(e?.response?.data?.detail || 'Failed to reject'); }
    finally { setActionLoading(false); }
  };

  return (
    <AdminScreen testID="admin-verification-requests-page" refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }}>
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient colors={['#10b981', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headTile}><Ionicons name="shield-checkmark" size={24} color={colors.white} /></LinearGradient>
        <View style={{ flex: 1 }}><Text style={styles.title}>Shops Verification Requests</Text><Text style={styles.subtitle}>Review and approve shop verification requests</Text></View>
        {pendingCount > 0 ? <View style={styles.pendingBadge}><Text style={styles.pendingText}>{pendingCount} Pending</Text></View> : null}
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
        {FILTERS.map(([v, l]) => (
          <TouchableOpacity key={v} onPress={() => setFilter(v)} testID={`filter-${v}`} activeOpacity={0.85}>
            {filter === v ? <LinearGradient colors={[colors.p450, colors.s600]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fchip}><Text style={[styles.fchipText, { color: colors.white }]}>{l}</Text></LinearGradient>
              : <View style={[styles.fchip, styles.fchipIdle]}><Text style={styles.fchipText}>{l}</Text></View>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? [0, 1, 2].map((i) => <Shimmer key={i} height={82} radius={radius.lg} style={{ marginBottom: 12 }} />)
        : filtered.length === 0 ? <View style={styles.empty}><Ionicons name="shield-outline" size={44} color={colors.border} /><Text style={styles.emptyTitle}>No verification requests</Text><Text style={styles.emptySub}>Requests will appear here when shops apply</Text></View>
          : (
            <View testID="verification-requests-list" style={{ gap: 12 }}>
              {filtered.map((req) => (
                <TouchableOpacity key={req.shop_id} activeOpacity={0.9} onPress={() => openDetail(req)} style={styles.card} testID={`verification-request-${req.shop_id}`}>
                  <View style={styles.logo}>{req.shop?.logo ? <Image source={{ uri: img(req.shop.logo) }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="storefront" size={22} color={colors.textMuted} />}</View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.shopName} numberOfLines={1}>{req.shop?.name || req.shop_name || 'Unknown Shop'}</Text>
                      <StatusBadge status={req.status} />
                    </View>
                    <View style={styles.metaRow}><Ionicons name="mail-outline" size={11} color={colors.textMuted} /><Text style={styles.metaText} numberOfLines={1}>{req.email}</Text></View>
                    {req.submitted_at ? <View style={styles.metaRow}><Ionicons name="time-outline" size={11} color={colors.textMuted} /><Text style={styles.metaText}>{fmtDate(req.submitted_at)}</Text></View> : null}
                  </View>
                  <View style={styles.checks}>
                    <Check on={req.email_verified} icon="mail" />
                    <Check on={req.shop?.latitude} icon="location" />
                    <Check on={req.document_uploaded} icon="document-text" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

      <DetailSheet request={selected} onClose={() => setSelected(null)} rejectReason={rejectReason} setRejectReason={setRejectReason} actionLoading={actionLoading} onApprove={approve} onReject={reject} />
    </AdminScreen>
  );
}

function Check({ on, icon }) {
  return <View style={[styles.check, { backgroundColor: on ? '#d1fae5' : '#f1f5f9' }]}><Ionicons name={icon} size={13} color={on ? '#059669' : colors.textMuted} /></View>;
}

function DetailSheet({ request, onClose, rejectReason, setRejectReason, actionLoading, onApprove, onReject }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  if (!request) return null;
  const r = request;
  const hasLoc = r.shop?.latitude && r.shop?.longitude;
  const docs = r.documents && Object.keys(r.documents).length > 0 ? Object.entries(r.documents) : (r.document_url ? [['document', r.document_url]] : []);
  const openMaps = () => Linking.openURL(`https://www.google.com/maps?q=${r.shop.latitude},${r.shop.longitude}`);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]} testID="verification-detail-dialog">
        <View style={styles.grabber} />
        <View style={styles.sheetTitleRow}><Ionicons name="shield-checkmark" size={18} color={colors.violet} /><Text style={styles.sheetTitle}>Verification Details</Text></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Shop info */}
          <View style={styles.shopInfo}>
            <View style={styles.shopInfoLogo}>{r.shop?.logo ? <Image source={{ uri: img(r.shop.logo) }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="storefront" size={20} color={colors.textMuted} />}</View>
            <View style={{ flex: 1 }}><Text style={styles.shopInfoName}>{r.shop?.name || r.shop_name}</Text><Text style={styles.shopInfoMeta}>{r.email} · {r.shop?.tier || 'starter'}</Text></View>
            <StatusBadge status={r.status} />
          </View>

          {/* Steps */}
          <Text style={styles.secTitle}>Verification Steps</Text>
          <Step on={r.email_verified} icon="mail" label="Email Verification" />
          <Step on={hasLoc} icon="location" label="Location Set" />
          <Step on={r.document_uploaded} icon="document-text" label="Document Uploaded" />

          {/* Location */}
          {hasLoc ? (
            <>
              <Text style={styles.secTitle}>Shop Location</Text>
              <View style={styles.locBox}>
                <View style={styles.locMapStub}><Ionicons name="location" size={26} color={colors.s500} /><Text style={styles.locCoords}>{r.shop.latitude.toFixed(5)}, {r.shop.longitude.toFixed(5)}</Text></View>
                <View style={styles.locFoot}>
                  {r.shop.location_address ? <Text style={styles.locAddr} numberOfLines={2}>{r.shop.location_address}</Text> : <Text style={styles.locAddr}>Tap to view on the map</Text>}
                  <TouchableOpacity style={styles.mapsBtn} onPress={openMaps} testID="view-shop-location-btn"><Ionicons name="map" size={13} color="#2563eb" /><Text style={styles.mapsBtnText}>Open in Maps</Text></TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* Documents */}
          {docs.length > 0 ? (
            <>
              <Text style={styles.secTitle}>Uploaded Documents</Text>
              {docs.map(([docType, url]) => {
                const isPdf = String(url).toLowerCase().endsWith('.pdf');
                return (
                  <View key={docType} style={styles.docCard}>
                    <View style={styles.docHead}>
                      <Text style={styles.docType}>{String(docType).replace(/_/g, ' ')}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity style={styles.docView} onPress={() => Linking.openURL(img(url))} testID={`view-doc-${docType}`}><Ionicons name="eye" size={12} color="#2563eb" /><Text style={styles.docViewText}>View</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.docDownload} onPress={() => Linking.openURL(img(url))} testID={`download-doc-${docType}`}><Ionicons name="download" size={12} color="#059669" /><Text style={styles.docDownloadText}>Download</Text></TouchableOpacity>
                      </View>
                    </View>
                    {isPdf ? <View style={styles.pdfRow}><Ionicons name="document-text" size={30} color="#ef4444" /><Text style={styles.pdfText}>PDF Document</Text></View>
                      : <Image source={{ uri: img(url) }} style={styles.docImg} resizeMode="contain" />}
                  </View>
                );
              })}
            </>
          ) : null}

          {r.submitted_at ? <Text style={styles.submitted}>Submitted: {fmtDate(r.submitted_at)}</Text> : null}

          {/* Actions */}
          {r.status === 'pending' ? (
            <View style={styles.actions}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => onApprove(r.shop_id)} disabled={actionLoading} testID="approve-verification-btn">
                <LinearGradient colors={['#059669', '#0d9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.approveBtn}>{actionLoading ? <Spinner size={16} color={colors.white} /> : <Ionicons name="ribbon" size={16} color={colors.white} />}<Text style={styles.approveText}>Approve Verification</Text></LinearGradient>
              </TouchableOpacity>
              <TextInput style={styles.reasonInput} placeholder="Rejection reason (optional)" placeholderTextColor={colors.textMuted} value={rejectReason} onChangeText={setRejectReason} testID="reject-reason-input" />
              <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(r.shop_id)} disabled={actionLoading} testID="reject-verification-btn"><Ionicons name="close-circle" size={16} color={colors.sale} /><Text style={styles.rejectText}>Reject</Text></TouchableOpacity>
            </View>
          ) : null}

          {r.status === 'rejected' && r.rejection_reason ? <View style={styles.rejBox}><Text style={styles.rejLabel}>Rejection Reason:</Text><Text style={styles.rejText}>{r.rejection_reason}</Text></View> : null}
          <View style={{ height: 12 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Step({ on, icon, label }) {
  return (
    <View style={[styles.step, { backgroundColor: on ? '#ecfdf5' : colors.surfaceMuted, borderColor: on ? '#a7f3d0' : colors.border }]}>
      <Ionicons name={icon} size={18} color={on ? '#059669' : colors.textMuted} />
      <Text style={styles.stepLabel}>{label}</Text>
      <Ionicons name={on ? 'checkmark-circle' : 'close-circle'} size={18} color={on ? '#059669' : colors.border} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headTile: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  pendingBadge: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pendingText: { fontFamily: fonts.bold, fontSize: 12, color: '#92400e' },
  fchip: { borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 9 },
  fchipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fchipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 46, gap: 6, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 14, ...shadow.card },
  logo: { width: 48, height: 48, borderRadius: 13, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shopName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, flex: 1 },
  checks: { flexDirection: 'row', gap: 5 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10 },

  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.ink },
  shopInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 12 },
  shopInfoLogo: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shopInfoName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  shopInfoMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  secTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: 18, marginBottom: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, padding: 12, marginBottom: 8 },
  stepLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  locBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  locMapStub: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.s50 },
  locCoords: { fontFamily: fonts.bold, fontSize: 12, color: colors.s700 },
  locFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  locAddr: { flex: 1, fontFamily: fonts.body, fontSize: 11.5, color: colors.textSecondary },
  mapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dbeafe', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  mapsBtnText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#2563eb' },
  docCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginBottom: 10 },
  docHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  docType: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary, textTransform: 'capitalize' },
  docView: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#dbeafe', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  docViewText: { fontFamily: fonts.bold, fontSize: 10, color: '#2563eb' },
  docDownload: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#d1fae5', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  docDownloadText: { fontFamily: fonts.bold, fontSize: 10, color: '#059669' },
  docImg: { width: '100%', height: 180, backgroundColor: colors.surface },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  pdfText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  submitted: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginTop: 14 },
  actions: { gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: 14 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md },
  approveText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14.5 },
  reasonInput: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#fecaca' },
  rejectText: { color: colors.sale, fontFamily: fonts.bold, fontSize: 14.5 },
  rejBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: radius.md, padding: 12, marginTop: 14 },
  rejLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: '#b91c1c', marginBottom: 3 },
  rejText: { fontFamily: fonts.body, fontSize: 13, color: '#dc2626' },
});
