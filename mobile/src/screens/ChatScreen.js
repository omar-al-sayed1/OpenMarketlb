import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { useAuth } from '../context/AuthContext';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const conv = route.params?.conversation || {};
  const name = route.params?.name || 'Chat';
  const convId = conv.conversation_id || conv.id;
  const recipientId = conv.other_party_id || conv.recipient_id || conv.op?.id || conv.shop_id || conv.user_id;
  const recipientType = conv.other_party_type || conv.recipient_type || conv.op?.type || (conv.shop_id ? 'shop' : 'admin');

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState(route.params?.initialText || ''); // e.g. prefilled "Regarding product: …" from a product page
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const myId = user?.id;

  const load = useCallback(() => {
    if (!convId || String(convId).startsWith('pending-')) return;
    api.messages.getConversation(convId)
      .then(({ data }) => setMessages(Array.isArray(data) ? data : data?.messages || []))
      .catch(() => {});
  }, [convId]);

  useEffect(() => { load(); }, [load]);
  // Poll while open
  useEffect(() => {
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100); }, [messages.length]);

  const isMine = (m) => (m.is_mine != null ? m.is_mine : String(m.sender_id) === String(myId));

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    setSending(true);
    // optimistic
    const temp = { id: `tmp-${Date.now()}`, message: body, sender_id: myId, is_mine: true, created_at: new Date().toISOString(), _pending: true };
    setMessages((prev) => [...prev, temp]);
    try {
      await api.messages.send({ recipient_id: recipientId, recipient_type: recipientType, message: body, conversation_id: convId });
      load();
    } catch (_) {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
    } finally { setSending(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.white} /></TouchableOpacity>
        <View style={styles.hAvatar}>
          {conv.other_party_avatar || conv.logo ? <Image source={{ uri: img(conv.other_party_avatar || conv.logo) }} style={{ width: '100%', height: '100%', borderRadius: 19 }} /> : <Text style={styles.hAvatarText}>{name.charAt(0).toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hName} numberOfLines={1}>{name}</Text>
          <Text style={styles.hStatus}>Active now</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => m.id || String(i)}
          contentContainerStyle={{ padding: 14, gap: 8, flexGrow: 1, justifyContent: 'flex-end' }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = isMine(item);
            const attach = item.attachment_url || item.image_url;
            return (
              <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                {mine ? (
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine, item._pending && { opacity: 0.7 }]}>
                    {attach ? <Image source={{ uri: img(attach) }} style={styles.attach} /> : null}
                    {item.message ? <Text style={styles.bubbleMineText}>{item.message}</Text> : null}
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, styles.bubbleThem]}>
                    {attach ? <Image source={{ uri: img(attach) }} style={styles.attach} /> : null}
                    {item.message ? <Text style={styles.bubbleThemText}>{item.message}</Text> : null}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<View style={styles.emptyChat}><Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} /><Text style={styles.emptyChatText}>Say hello 👋</Text></View>}
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: (insets.bottom || 10) + 6 }]}>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="Type a message…" placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} multiline />
          </View>
          <TouchableOpacity activeOpacity={0.9} onPress={send} disabled={!text.trim()}>
            <LinearGradient colors={gradients.primary} style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]}><Ionicons name="send" size={18} color={colors.white} /></LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12, ...shadow.card },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  hAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hAvatarText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  hName: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  hStatus: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { borderBottomRightRadius: 5, ...shadow.violetGlow },
  bubbleThem: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.borderLight },
  bubbleMineText: { color: colors.white, fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  bubbleThemText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  attach: { width: 180, height: 180, borderRadius: 12, marginBottom: 4, backgroundColor: colors.surfaceMuted },
  emptyChat: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyChatText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  inputWrap: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, maxHeight: 110, justifyContent: 'center' },
  input: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
