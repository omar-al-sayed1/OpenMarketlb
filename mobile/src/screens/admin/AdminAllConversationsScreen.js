import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Alert } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { Bubble, MsgAttachment, chatTime } from '../../components/admin/ChatKit';
import { colors, gradients, radius, fonts, shadow } from '../../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

const partyIcon = (type) => (type === 'shop' ? 'storefront' : type === 'admin' ? 'shield-checkmark' : 'person');

export default function AdminAllConversationsScreen() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState({});
  const scrollRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.messages.adminGetConversations().then(({ data }) => setConversations(data.conversations || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (conv) => {
    setSelected(conv); setMessages([]);
    try { const { data } = await api.messages.adminGetConversation(conv.conversation_id); setMessages(data.messages || []); } catch (_) { setMessages([]); }
  };
  const reload = async () => { if (!selected) return; try { const { data } = await api.messages.adminGetConversation(selected.conversation_id); setMessages(data.messages || []); } catch (_) {} };

  const onSearch = (t) => { LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity')); setSearch(t); };

  const del = (m) => Alert.alert('Delete this message?', 'It will be shown as “Deleted by admin”. You can still reveal the original afterwards.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.messages.adminDeleteMessage(m.id); reload(); } catch (e) { Alert.alert('Failed', e?.response?.data?.detail || 'Could not delete.'); } } },
  ]);

  const filtered = useMemo(() => conversations.filter((c) =>
    (c.party_a?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.party_b?.name || '').toLowerCase().includes(search.toLowerCase())
  ), [conversations, search]);

  /* ---------- THREAD VIEW ---------- */
  if (selected) {
    return (
      <View style={styles.flex}>
        <View style={styles.threadHead}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={colors.ink} /></TouchableOpacity>
          <View style={styles.partyChip}><Ionicons name={partyIcon(selected.party_a?.type)} size={13} color={colors.textSecondary} /><Text style={styles.partyChipText} numberOfLines={1}>{selected.party_a?.name}</Text></View>
          <Ionicons name="swap-horizontal" size={14} color={colors.textMuted} />
          <View style={styles.partyChip}><Ionicons name={partyIcon(selected.party_b?.type)} size={13} color={colors.textSecondary} /><Text style={styles.partyChipText} numberOfLines={1}>{selected.party_b?.name}</Text></View>
        </View>
        <ScrollView ref={scrollRef} style={styles.chatBg} contentContainerStyle={{ padding: 14, gap: 10 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((m) => {
            const fromA = m.sender_id === selected.party_a?.id;
            const mine = !fromA; // right side / violet
            return (
              <Bubble key={m.id} mine={mine} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {!m.is_deleted && !fromA && <TouchableOpacity onPress={() => del(m)} style={styles.delBtn}><Ionicons name="trash-outline" size={14} color={colors.textMuted} /></TouchableOpacity>}
                  {mine ? (
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
                      <ThreadBody m={m} mine revealed={revealed} setRevealed={setRevealed} />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.bubbleTheirs]}>
                      <ThreadBody m={m} mine={false} revealed={revealed} setRevealed={setRevealed} />
                    </View>
                  )}
                  {!m.is_deleted && fromA && <TouchableOpacity onPress={() => del(m)} style={styles.delBtn}><Ionicons name="trash-outline" size={14} color={colors.textMuted} /></TouchableOpacity>}
                </View>
              </Bubble>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  /* ---------- LIST VIEW ---------- */
  return (
    <View style={styles.flex}>
      <LinearGradient colors={['#f8fafc', '#ffffff', colors.s50]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.listHead}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search by participant…" placeholderTextColor={colors.textMuted} value={search} onChangeText={onSearch} />
        </View>
        <Text style={styles.total}>{conversations.length} total</Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.conversation_id}
        contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name={loading ? 'sync' : 'chatbubbles-outline'} size={40} color={colors.textMuted} /><Text style={styles.emptyText}>{loading ? 'Loading…' : 'No conversations'}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.convRow} activeOpacity={0.8} onPress={() => open(item)}>
            <View style={styles.convPartiesLine}>
              <View style={styles.miniChip}><Ionicons name={partyIcon(item.party_a?.type)} size={11} color={colors.textSecondary} /></View>
              <Text style={styles.partyName} numberOfLines={1}>{item.party_a?.name}</Text>
              <Text style={styles.arrow}>↔</Text>
              <View style={styles.miniChip}><Ionicons name={partyIcon(item.party_b?.type)} size={11} color={colors.textSecondary} /></View>
              <Text style={styles.partyName} numberOfLines={1}>{item.party_b?.name}</Text>
              <Text style={styles.convTime}>{chatTime(item.last_message_time)}</Text>
            </View>
            <Text style={styles.convLast} numberOfLines={1}>{item.last_message}</Text>
            <View style={styles.convMeta}>
              <Text style={styles.msgCount}>{item.message_count} messages</Text>
              {item.unread_count > 0 && <View style={styles.unreadChip}><Text style={styles.unreadChipText}>{item.unread_count} unread</Text></View>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ThreadBody({ m, mine, revealed, setRevealed }) {
  const muted = mine ? 'rgba(255,255,255,0.75)' : colors.textMuted;
  return (
    <>
      <Text style={[styles.sender, { color: muted }]}>{m.sender_name} <Text style={{ textTransform: 'capitalize' }}>({m.sender_type})</Text></Text>
      {m.is_deleted ? (
        <View>
          <Text style={[styles.deleted, { color: muted }]}>🗑 Deleted by {m.deleted_by || 'user'}</Text>
          {(m.deleted_original || m.deleted_attachment_url) ? (
            <TouchableOpacity onPress={() => setRevealed((r) => ({ ...r, [m.id]: !r[m.id] }))}>
              <Text style={[styles.reveal, { color: mine ? colors.white : colors.violet }]}>{revealed[m.id] ? 'Hide' : 'Show deleted message'}</Text>
            </TouchableOpacity>
          ) : null}
          {revealed[m.id] ? (
            <View style={[styles.revealBox, { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : colors.surfaceMuted }]}>
              <Text style={[styles.bubbleText, { color: mine ? colors.white : colors.textSecondary }]}>{m.deleted_original || '(no text)'}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <MsgAttachment msg={m} mine={mine} />
          {m.message ? <Text style={[styles.bubbleText, { color: mine ? colors.white : colors.ink }]}>{m.message}</Text> : null}
        </>
      )}
      <Text style={[styles.metaTime, { color: muted }]}>{chatTime(m.created_at)}{m.is_edited && !m.is_deleted ? ' · edited' : ''}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: 14, height: 42 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 0 },
  total: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  convRow: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, padding: 12, marginBottom: 8, ...shadow.card },
  convPartiesLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniChip: { width: 22, height: 22, borderRadius: 7, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center' },
  partyName: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, maxWidth: 90 },
  arrow: { color: colors.textMuted, fontSize: 12 },
  convTime: { marginLeft: 'auto', fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  convLast: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 6 },
  convMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  msgCount: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  unreadChip: { backgroundColor: '#fef3c7', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  unreadChipText: { fontFamily: fonts.bold, fontSize: 9, color: '#b45309' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  // thread
  threadHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  backBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  partyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.bgAlt, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, maxWidth: 120 },
  partyChipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  chatBg: { flex: 1, backgroundColor: colors.surfaceMuted },
  delBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: 270, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { borderBottomRightRadius: 5, ...shadow.violetGlow },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, borderBottomLeftRadius: 5, ...shadow.card },
  bubbleText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  sender: { fontFamily: fonts.bold, fontSize: 10, marginBottom: 3 },
  deleted: { fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic' },
  reveal: { fontFamily: fonts.bold, fontSize: 11, marginTop: 3 },
  revealBox: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  metaTime: { fontFamily: fonts.body, fontSize: 10, marginTop: 4 },
});
