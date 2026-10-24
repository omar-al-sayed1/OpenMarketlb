import React, { useEffect, useState, useCallback, useRef } from 'react';
import useKeyboardHeight from '../../lib/useKeyboardHeight';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList, Modal, KeyboardAvoidingView, Platform, Animated, ActivityIndicator } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { pickImage } from '../../lib/imagePick';
import { api } from '../../lib/api';
import { tapLight, notifyError } from '../../lib/haptics';
import { Bubble, MsgAttachment, TypingDots, chatTime, clockTime } from '../../components/admin/ChatKit';
import { colors, gradients, radius, fonts, shadow } from '../../theme/theme';

/* pulsing unread dot */
function Pulse() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([
    Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: true }),
    Animated.timing(a, { toValue: 0, duration: 800, useNativeDriver: true }),
  ])).start(); }, []); // eslint-disable-line
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }] }]} />
      <View style={styles.pulseCore} />
    </View>
  );
}

export default function AdminMessagesScreen() {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const scrollRef = useRef(null);
  const selectedRef = useRef(null);

  const loadConversations = useCallback(() => {
    api.messages.getConversations().then(({ data }) => setConversations(data.conversations || [])).catch(() => {});
  }, []);
  useEffect(() => { loadConversations(); const t = setInterval(loadConversations, 20000); return () => clearInterval(t); }, [loadConversations]);

  const loadMessages = useCallback((cid) => {
    api.messages.getConversation(cid).then(({ data }) => setMessages(data.messages || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!selected) return;
    selectedRef.current = selected;
    loadMessages(selected.conversation_id);
    const t = setInterval(() => { if (selectedRef.current) loadMessages(selectedRef.current.conversation_id); }, 8000);
    return () => clearInterval(t);
  }, [selected, loadMessages]);

  const open = (conv) => { tapLight(); setSelected(conv); setMessages([]); };
  const back = () => { setSelected(null); setEditingId(null); loadConversations(); };

  const sendReply = async (attachment = null) => {
    if ((!newMessage.trim() && !attachment) || !selected) return;
    const payload = { recipient_id: selected.other_party.id, recipient_type: selected.other_party.type, message: newMessage || '' };
    if (attachment?.type === 'image') { payload.attachment_type = 'image'; payload.attachment_url = attachment.url; payload.image_url = attachment.url; }
    setSending(true);
    try {
      await api.messages.send(payload);
      setNewMessage('');
      loadMessages(selected.conversation_id);
      loadConversations();
    } catch (_) { notifyError(); Alert.alert('Failed', 'Could not send message.'); }
    finally { setSending(false); }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to attach images.');
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const { data } = await api.messages.uploadAttachment({ uri: asset.uri, name: asset.fileName || `photo_${Date.now()}.jpg`, mimeType: asset.mimeType || 'image/jpeg' });
      if (data?.url) await sendReply({ type: 'image', url: data.url });
      else throw new Error('no url');
    } catch (_) { notifyError(); Alert.alert('Upload failed', 'Could not upload the image.'); }
    finally { setUploading(false); }
  };

  const submitEdit = async () => {
    const t = editText.trim(); if (!t) return;
    try { await api.messages.edit(editingId, t); setEditingId(null); setEditText(''); loadMessages(selected.conversation_id); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not edit message.'); }
  };
  const msgActions = (m) => {
    if (m.sender_type !== 'admin' || m.is_deleted) return;
    Alert.alert('Message', null, [
      { text: 'Edit', onPress: () => { setEditingId(m.id); setEditText(m.message || ''); } },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.messages.remove(m.id); loadMessages(selected.conversation_id); } catch (_) {} } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const filtered = conversations.filter((c) => c.other_party.name.toLowerCase().includes(search.toLowerCase()));

  /* ---------- CHAT VIEW ---------- */
  if (selected) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.chatHead}>
          <TouchableOpacity onPress={back} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={colors.ink} /></TouchableOpacity>
          <View style={styles.headAvatar}><Ionicons name="person" size={16} color={colors.violet} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headName} numberOfLines={1}>{selected.other_party.name}</Text>
            <Text style={styles.headType}>{selected.other_party.type}</Text>
          </View>
        </View>
        <ScrollView ref={scrollRef} style={styles.chatBg} contentContainerStyle={{ padding: 14, gap: 10 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((m) => {
            const mine = m.sender_type === 'admin';
            const isEditing = editingId === m.id;
            return (
              <Bubble key={m.id} mine={mine} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <TouchableOpacity activeOpacity={mine ? 0.85 : 1} onLongPress={() => msgActions(m)}>
                  {mine ? (
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
                      <BubbleBody m={m} mine isEditing={isEditing} editText={editText} setEditText={setEditText} submitEdit={submitEdit} cancel={() => { setEditingId(null); setEditText(''); }} />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.bubbleTheirs]}>
                      <BubbleBody m={m} mine={false} isEditing={false} />
                    </View>
                  )}
                </TouchableOpacity>
              </Bubble>
            );
          })}
          {(sending || uploading) && <View style={{ alignItems: 'flex-end' }}><TypingDots /></View>}
        </ScrollView>
        <View style={[styles.inputBar, { paddingBottom: (insets.bottom || 8) }]}>
          <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.iconBtn}>
            {uploading ? <ActivityIndicator size="small" color={colors.violet} /> : <Ionicons name="image" size={22} color={colors.textMuted} />}
          </TouchableOpacity>
          <TextInput style={styles.input} placeholder="Type a message…" placeholderTextColor={colors.textMuted} value={newMessage} onChangeText={setNewMessage} multiline />
          <TouchableOpacity onPress={() => sendReply()} disabled={!newMessage.trim() || sending} activeOpacity={0.85}>
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.sendBtn, (!newMessage.trim() || sending) && { opacity: 0.5 }]}>
              <Ionicons name="send" size={17} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  /* ---------- LIST VIEW ---------- */
  return (
    <View style={styles.flex}>
      <LinearGradient colors={['#f8fafc', '#ffffff', colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.listHead}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search conversations…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newBtn}>
            <Ionicons name="create" size={16} color={colors.white} />
            <Text style={styles.newBtnText}>New</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.conversation_id}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} /><Text style={styles.emptyText}>No conversations</Text></View>}
        renderItem={({ item }) => {
          const unread = item.unread_count > 0;
          return (
            <TouchableOpacity style={[styles.convRow, unread && styles.convRowUnread]} activeOpacity={0.8} onPress={() => open(item)}>
              <View style={[styles.convAvatar, unread && { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="person" size={18} color={unread ? colors.violet : colors.textMuted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.convTop}>
                  <Text style={[styles.convName, unread && styles.convNameUnread]} numberOfLines={1}>{item.other_party.name}</Text>
                  <Text style={styles.convTime}>{chatTime(item.last_message_time)}</Text>
                </View>
                {item.subject ? <Text style={styles.convSubject} numberOfLines={1}>{item.subject}</Text> : null}
                <Text style={styles.convLast} numberOfLines={1}>{item.last_message}</Text>
              </View>
              {unread && (
                <View style={styles.convRight}>
                  <Pulse />
                  <View style={styles.convBadge}><Text style={styles.convBadgeText}>{item.unread_count}</Text></View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onSent={() => { setComposeOpen(false); loadConversations(); }} />
    </View>
  );
}

/* bubble content (text / editing / attachment / meta) */
function BubbleBody({ m, mine, isEditing, editText, setEditText, submitEdit, cancel }) {
  if (m.is_deleted) {
    return <Text style={[styles.deleted, { color: mine ? 'rgba(255,255,255,0.8)' : colors.textMuted }]}>🗑 message deleted</Text>;
  }
  if (isEditing) {
    return (
      <View style={{ minWidth: 180, gap: 6 }}>
        <TextInput value={editText} onChangeText={setEditText} autoFocus style={styles.editInput} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity onPress={cancel}><Text style={styles.editCancel}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={submitEdit}><Text style={styles.editSave}>Save</Text></TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <>
      <MsgAttachment msg={m} mine={mine} />
      {m.message && m.message !== '(photo)' ? <Text style={[styles.bubbleText, { color: mine ? colors.white : colors.ink }]}>{m.message}</Text> : null}
      <View style={styles.metaRow}>
        <Text style={[styles.metaTime, { color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>{clockTime(m.created_at)}</Text>
        {m.is_edited && !m.is_deleted ? <Text style={[styles.metaTime, { color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>· edited</Text> : null}
        {mine ? <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.85)" /> : null}
      </View>
    </>
  );
}

/* ---------- Compose modal (shops / users / agents) ---------- */
function ComposeModal({ open, onClose, onSent }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [mode, setMode] = useState('shops');
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selShops, setSelShops] = useState([]);
  const [selUsers, setSelUsers] = useState([]);
  const [selAgents, setSelAgents] = useState([]);
  const [allShops, setAllShops] = useState(false);
  const [allUsers, setAllUsers] = useState(false);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.messages.getShopsList().then(({ data }) => setShops(data.shops || [])).catch(() => {});
    api.messages.getUsersList().then(({ data }) => setUsers(data.users || [])).catch(() => {});
    api.admin.listReferralAgents().then(({ data }) => setAgents(Array.isArray(data) ? data : data?.agents || [])).catch(() => {});
  }, [open]);

  const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const send = async () => {
    if (!body.trim()) return Alert.alert('Message required', 'Type a message first.');
    let payload;
    if (mode === 'agents') {
      if (!selAgents.length) return Alert.alert('Select agents', 'Pick at least one agent.');
      payload = { recipient_ids: selAgents, recipient_type: 'agent', subject, message: body };
    } else if (mode === 'users') {
      if (!allUsers && !selUsers.length) return Alert.alert('Select users', 'Pick at least one user.');
      payload = { recipient_ids: allUsers ? [] : selUsers, recipient_type: 'user', send_to_all_users: allUsers, subject, message: body };
    } else {
      if (!allShops && !selShops.length) return Alert.alert('Select shops', 'Pick at least one shop.');
      payload = { recipient_ids: allShops ? [] : selShops, recipient_type: 'shop', send_to_all_shops: allShops, subject, message: body };
    }
    setBusy(true);
    try { await api.messages.send(payload); setSubject(''); setBody(''); setSelShops([]); setSelUsers([]); setSelAgents([]); setAllShops(false); setAllUsers(false); onSent(); }
    catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not send message.'); }
    finally { setBusy(false); }
  };

  const modes = [{ k: 'shops', label: 'Shops', icon: 'storefront' }, { k: 'users', label: 'Users', icon: 'person' }, { k: 'agents', label: 'Agents', icon: 'person-circle' }];
  const list = mode === 'shops' ? shops : mode === 'users' ? users : agents;
  const sel = mode === 'shops' ? selShops : mode === 'users' ? selUsers : selAgents;
  const setSel = mode === 'shops' ? setSelShops : mode === 'users' ? setSelUsers : setSelAgents;
  const showAll = mode === 'shops' ? allShops : mode === 'users' ? allUsers : false;
  const filteredList = list.filter((x) => (x.name || x.email || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}><TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} /></View>
      <View style={[styles.sheet, { paddingBottom: (insets.bottom || 12) + 8, marginBottom: kb }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Compose message</Text>
        <View style={styles.modeRow}>
          {modes.map((m) => {
            const active = mode === m.k;
            const emerald = m.k === 'agents';
            return (
              <TouchableOpacity key={m.k} onPress={() => { setMode(m.k); setQ(''); }} style={[styles.modeBtn, active && (emerald ? styles.modeActiveEmerald : styles.modeActive)]}>
                <Ionicons name={m.icon} size={15} color={active ? (emerald ? colors.seller : colors.violet) : colors.textMuted} />
                <Text style={[styles.modeText, active && { color: emerald ? colors.sellerSoftText : colors.primarySoftText }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {(mode === 'shops' || mode === 'users') && (
          <TouchableOpacity style={styles.allRow} activeOpacity={0.8} onPress={() => (mode === 'shops' ? setAllShops(!allShops) : setAllUsers(!allUsers))}>
            <Ionicons name={showAll ? 'checkbox' : 'square-outline'} size={20} color={showAll ? colors.violet : colors.textMuted} />
            <Ionicons name="people" size={16} color={colors.violet} />
            <Text style={styles.allText}>Send to all {mode}</Text>
          </TouchableOpacity>
        )}

        {!showAll && (
          <>
            <View style={[styles.searchWrap, { marginTop: 4 }]}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder={`Search ${mode}…`} placeholderTextColor={colors.textMuted} value={q} onChangeText={setQ} />
            </View>
            <View style={styles.selectBox}>
              <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                {filteredList.length === 0 ? <Text style={styles.noneText}>No {mode} found</Text> : filteredList.map((x) => {
                  const on = sel.includes(x.id);
                  return (
                    <TouchableOpacity key={x.id} style={styles.selRow} activeOpacity={0.8} onPress={() => toggle(sel, setSel, x.id)}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? colors.violet : colors.textMuted} />
                      <Text style={styles.selName} numberOfLines={1}>{x.name || x.email}</Text>
                      {x.status && x.status !== 'approved' ? <View style={styles.statusChip}><Text style={styles.statusChipText}>{x.status}</Text></View> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={styles.selCount}>{sel.length} selected</Text>
          </>
        )}

        <TextInput style={styles.composeInput} placeholder="Subject (optional)" placeholderTextColor={colors.textMuted} value={subject} onChangeText={setSubject} />
        <TextInput style={[styles.composeInput, { height: 90, textAlignVertical: 'top' }]} placeholder="Message *" placeholderTextColor={colors.textMuted} value={body} onChangeText={setBody} multiline />
        <TouchableOpacity onPress={send} disabled={busy} activeOpacity={0.9}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
            <Ionicons name="send" size={15} color={colors.white} />
            <Text style={styles.submitText}>{busy ? 'Sending…' : 'Send'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  // list head
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, height: 42, borderRadius: radius.pill, ...shadow.violetGlow },
  newBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 13 },
  // conversation row
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  convRowUnread: { backgroundColor: colors.primarySoft },
  convAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  convTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  convNameUnread: { fontFamily: fonts.extrabold, color: colors.ink },
  convTime: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginLeft: 8 },
  convSubject: { fontFamily: fonts.semibold, fontSize: 12, color: colors.violet, marginTop: 1 },
  convLast: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  convRight: { alignItems: 'center', gap: 6 },
  convBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  convBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  pulseWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.violet },
  pulseCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.violet },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  // chat
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  headName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  headType: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
  chatBg: { flex: 1, backgroundColor: colors.surfaceMuted },
  bubble: { maxWidth: 290, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { borderBottomRightRadius: 5, ...shadow.violetGlow },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderBottomLeftRadius: 5, ...shadow.card },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  deleted: { fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaTime: { fontFamily: fonts.body, fontSize: 10 },
  editInput: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 8, height: 34, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  editCancel: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.semibold, fontSize: 12 },
  editSave: { color: colors.white, fontFamily: fonts.bold, fontSize: 12, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, maxHeight: 110, minHeight: 40, backgroundColor: colors.surfaceMuted, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  // compose sheet
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink, marginBottom: 12 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  modeActive: { borderColor: colors.violet, backgroundColor: colors.primarySoft },
  modeActiveEmerald: { borderColor: colors.seller, backgroundColor: colors.sellerSoft },
  modeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  allRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  allText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  selectBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 6, marginTop: 8 },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6 },
  selName: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  statusChip: { backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  statusChipText: { fontFamily: fonts.bold, fontSize: 9, color: '#b45309', textTransform: 'capitalize' },
  noneText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  selCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, marginTop: 5, marginLeft: 2 },
  composeInput: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 46, fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginTop: 10 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.md, marginTop: 12 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
});
