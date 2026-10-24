import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, getSessionId } from '../lib/api';
import { tapLight } from '../lib/haptics';
import { TAB_SPACE } from './ui';
import { colors, gradients, radius, fonts, shadow } from '../theme/theme';

export default function AIChatbot() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const sid = useRef(null);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || busy) return;
    tapLight();
    setText('');
    setMessages((prev) => [...prev, { role: 'user', content: body }]);
    setBusy(true);
    try {
      if (!sid.current) sid.current = await getSessionId();
      const { data } = await api.ai.chat(body, sid.current);
      setMessages((prev) => [...prev, { role: 'assistant', content: data?.reply || "I'm here to help!" }]);
    } catch (_) {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that. Please try again!" }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [text, busy]);

  return (
    <>
      {/* Floating FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: TAB_SPACE - 16 }]} activeOpacity={0.9} onPress={() => { tapLight(); setOpen(true); }}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="sparkles" size={19} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Chat sheet */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
            {/* Header */}
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
              <View style={styles.hIcon}><Ionicons name="sparkles" size={18} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hTitle}>Shopping Assistant</Text>
                <Text style={styles.hSub}>Ask me anything about products & shops</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.hClose}><Ionicons name="close" size={20} color={colors.white} /></TouchableOpacity>
            </LinearGradient>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m, i) => String(i)}
              contentContainerStyle={{ padding: 14, gap: 8, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={(
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}><Ionicons name="sparkles" size={26} color={colors.violet} /></View>
                  <Text style={styles.emptyTitle}>Hi! I'm your shopping assistant</Text>
                  <Text style={styles.emptySub}>Try "Show me deals under $10" or "Find shops near me".</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <View style={[styles.row, item.role === 'user' ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                  {item.role === 'user' ? (
                    <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}><Text style={styles.bubbleMineText}>{item.content}</Text></LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.bubbleBot]}><Text style={styles.bubbleBotText}>{item.content}</Text></View>
                  )}
                </View>
              )}
            />

            {busy && <View style={styles.typing}><ActivityIndicator size="small" color={colors.violet} /><Text style={styles.typingText}>Assistant is typing…</Text></View>}

            <View style={[styles.inputBar, { paddingBottom: (insets.bottom || 10) + 6 }]}>
              <View style={styles.inputWrap}><TextInput style={styles.input} placeholder="Type a message…" placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} onSubmitEditing={send} /></View>
              <TouchableOpacity activeOpacity={0.9} onPress={send} disabled={!text.trim()}>
                <LinearGradient colors={gradients.primary} style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]}><Ionicons name="send" size={18} color={colors.white} /></LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, width: 46, height: 46, zIndex: 50 },
  fabInner: { flex: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: colors.surface, ...shadow.violetGlow },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { height: '82%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  hIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 15 },
  hSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 11 },
  hClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 30 },
  row: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  bubbleMine: { borderBottomRightRadius: 5 },
  bubbleBot: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.borderLight },
  bubbleMineText: { color: colors.white, fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  bubbleBotText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  typingText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  inputWrap: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 46, justifyContent: 'center' },
  input: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
