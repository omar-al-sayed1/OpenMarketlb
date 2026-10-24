import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, FlatList, Animated as RNAnimated, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { tapLight, tapMedium } from '../../lib/haptics';
import { colors, agent, radius, fonts, shadow } from '../../theme/theme';
import { toast } from '../../components/shop/ShopKit';

const BUBBLE = [colors.p450, '#ffc0cb']; // violet-500 -> fuchsia-500

/* typing dots while sending */
function TypingDots() {
  const dots = [useRef(new RNAnimated.Value(0)).current, useRef(new RNAnimated.Value(0)).current, useRef(new RNAnimated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.delay(i * 160),
      RNAnimated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []); // eslint-disable-line
  return (
    <View style={[td.bubble]}>
      {dots.map((d, i) => (
        <RNAnimated.View key={i} style={[td.dot, { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]} />
      ))}
    </View>
  );
}
const td = StyleSheet.create({
  bubble: { flexDirection: 'row', gap: 4, alignSelf: 'flex-end', backgroundColor: colors.p100, borderRadius: 16, borderBottomRightRadius: 5, paddingHorizontal: 13, paddingVertical: 11 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.p400 },
});

/* bubble wiggles when it enters edit mode */
function Wiggle({ active, children }) {
  const a = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (active) {
      RNAnimated.sequence([
        RNAnimated.timing(a, { toValue: 1, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: -1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: 1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [active, a]);
  return <RNAnimated.View style={{ transform: [{ rotate: a.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] }) }] }}>{children}</RNAnimated.View>;
}

export default function AgentMessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const agentId = user?.id;
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef(null);

  const loadConversation = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await api.messages.getConversations();
      const convs = data?.conversations || [];
      const adminConv = convs.find(c => c.other_party?.type === 'admin') || convs[0];
      if (adminConv) {
        setConversationId(adminConv.conversation_id);
        const res = await api.messages.getConversation(adminConv.conversation_id);
        setMessages(res.data?.messages || []);
      } else { setMessages([]); setConversationId(null); }
    } catch (e) { if (!silent) toast.error('Failed to load messages'); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    loadConversation();
    const t = setInterval(() => loadConversation(true), 12000); // heartbeat
    return () => clearInterval(t);
  }, [loadConversation]);
  useEffect(() => { if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100); }, [messages.length]);

  const isMine = (m) => m.sender_type === 'agent' || m.sender_id === agentId;

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, sender_id: agentId, sender_type: 'agent', sender_name: user?.name || 'You', message: body, created_at: new Date().toISOString(), _optimistic: true };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    try {
      await api.messages.send({ recipient_id: 'admin', recipient_type: 'admin', message: body, subject: 'Agent Support' });
      await loadConversation(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(body);
    } finally { setSending(false); }
  };

  const submitEdit = async () => {
    const t = editText.trim(); if (!t) return;
    try { await api.messages.edit(editingId, t); setEditingId(null); setEditText(''); loadConversation(true); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to edit message'); }
  };
  const removeMsg = async (m) => {
    setMenuFor(null);
    try { await api.messages.remove(m.id); loadConversation(true); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete message'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }}>
      {/* Header — violet-600 -> fuchsia-600 -> purple-600 */}
      <LinearGradient colors={agent.messagesHead} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top + 8 }}>
        <View style={st.header}>
          <View style={st.adminAvatar}><Ionicons name="shield-checkmark" size={19} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.adminName}>OpenMarket Admin</Text>
            <Text style={st.adminSub}>Support & Operations</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} testID="agent-messages-window">
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => m.id || String(i)}
          contentContainerStyle={{ padding: 14, gap: 9, flexGrow: 1, justifyContent: 'flex-end' }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Text style={st.emptySub}>Loading conversation…</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 70, gap: 8 }}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                <Text style={st.emptyTitle}>No messages yet</Text>
                <Text style={st.emptySub}>Send a message below to start a conversation with the admin team.</Text>
              </View>
            )
          }
          renderItem={({ item: m }) => {
            const mine = isMine(m);
            const isEditing = editingId === m.id;
            const bubble = (
              <Wiggle active={isEditing}>
                {mine ? (
                  <LinearGradient colors={BUBBLE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.bubble, st.bubbleMine, m._optimistic && { opacity: 0.7 }]}>
                    <BubbleContent m={m} mine isEditing={isEditing} editText={editText} setEditText={setEditText} submitEdit={submitEdit} cancelEdit={() => { setEditingId(null); setEditText(''); }} />
                  </LinearGradient>
                ) : (
                  <View style={[st.bubble, st.bubbleThem]}>
                    <Text style={st.senderName}>{m.sender_name || 'Admin'}</Text>
                    <BubbleContent m={m} mine={false} isEditing={false} />
                  </View>
                )}
              </Wiggle>
            );
            return (
              <Animated.View layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={FadeOut.duration(360)}
                style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}
                testID={`agent-msg-${mine ? 'out' : 'in'}`}>
                {mine && !m.is_deleted && !isEditing && !m._optimistic ? (
                  <TouchableOpacity activeOpacity={0.85} onLongPress={() => { tapMedium(); setMenuFor(m); }} delayLongPress={280}>{bubble}</TouchableOpacity>
                ) : bubble}
              </Animated.View>
            );
          }}
          ListFooterComponent={sending ? <View style={{ marginTop: 4 }}><TypingDots /></View> : null}
        />

        {/* Composer */}
        <View style={[st.composer, { paddingBottom: (insets.bottom || 10) + 6 }]}>
          <View style={st.inputWrap}>
            <TextInput value={text} onChangeText={setText} placeholder="Type a message to admin…" placeholderTextColor={colors.textMuted}
              style={st.input} multiline testID="agent-message-input" />
          </View>
          <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()} activeOpacity={0.9} testID="agent-message-send">
            <LinearGradient colors={BUBBLE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}>
              <Ionicons name={sending ? 'hourglass' : 'send'} size={17} color={colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* long-press context menu */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <BlurView intensity={20} tint="dark" style={st.menuBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setMenuFor(null)} />
          <View style={st.menuSheet}>
            <TouchableOpacity style={st.menuRow} activeOpacity={0.75}
              onPress={() => { setEditingId(menuFor.id); setEditText(menuFor.message || ''); tapLight(); setMenuFor(null); }}>
              <Ionicons name="create" size={17} color={colors.text} />
              <Text style={st.menuText}>Edit message</Text>
            </TouchableOpacity>
            <View style={st.menuDivider} />
            <TouchableOpacity style={st.menuRow} activeOpacity={0.75} onPress={() => removeMsg(menuFor)}>
              <Ionicons name="trash" size={17} color="#dc2626" />
              <Text style={[st.menuText, { color: '#dc2626' }]}>Delete message</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

function BubbleContent({ m, mine, isEditing, editText, setEditText, submitEdit, cancelEdit }) {
  if (m.is_deleted) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name="trash" size={11} color={mine ? 'rgba(255,255,255,0.7)' : colors.textMuted} />
        <Text style={{ fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic', color: mine ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>message deleted</Text>
      </View>
    );
  }
  if (isEditing) {
    return (
      <View style={{ minWidth: 190, gap: 7 }}>
        <TextInput value={editText} onChangeText={setEditText} autoFocus multiline style={bc.editInput} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <TouchableOpacity onPress={cancelEdit}><Text style={bc.editCancel}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={submitEdit} style={bc.editSave}><Text style={bc.editSaveText}>Save</Text></TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <>
      <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: mine ? colors.white : colors.text }}>{m.message}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 9.5, color: mine ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>
          {m.created_at ? new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
        </Text>
        {m.is_edited && !m.is_deleted ? <Text style={{ fontFamily: fonts.body, fontSize: 9.5, fontStyle: 'italic', color: mine ? 'rgba(255,255,255,0.7)' : colors.textMuted }}>· edited</Text> : null}
      </View>
    </>
  );
}
const bc = StyleSheet.create({
  editInput: { backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 9, paddingVertical: 7, fontFamily: fonts.body, fontSize: 13.5, color: colors.text, maxHeight: 100 },
  editCancel: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  editSave: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.badge, paddingHorizontal: 9, paddingVertical: 2.5 },
  editSaveText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
});

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingBottom: 13 },
  adminAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  adminName: { color: colors.white, fontFamily: fonts.bold, fontSize: 14.5 },
  adminSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textSecondary },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 2, paddingHorizontal: 30 },
  bubble: { maxWidth: 290, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { borderBottomRightRadius: 5, ...agent.fuchsiaGlow },
  bubbleThem: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  senderName: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.p500, marginBottom: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  inputWrap: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, maxHeight: 110, justifyContent: 'center' },
  input: { fontFamily: fonts.body, fontSize: 14.5, color: colors.ink, paddingVertical: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...agent.fuchsiaGlow },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 16 },
  menuSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14, ...shadow.dropdown },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 17, paddingVertical: 15 },
  menuText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.borderLight },
});
