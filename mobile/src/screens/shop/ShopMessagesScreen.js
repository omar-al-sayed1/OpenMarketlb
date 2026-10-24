import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, FlatList, Image, Animated as RNAnimated, Easing, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { pickImage } from '../../lib/imagePick';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { api } from '../../lib/api';
import { img, MEDIA_BASE_URL } from '../../lib/media';
import { tapLight, tapMedium } from '../../lib/haptics';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { TAB_SPACE } from '../../components/ui';
import { Rise, PressScale, Spinner, ToastHost, toast } from '../../components/shop/ShopKit';

const EMERALD = ['#059669', '#0d9488']; // emerald-600 -> teal-600 bubbles

const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/* bubble wiggles when it enters edit mode */
function Wiggle({ active, children }) {
  const a = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    if (active) {
      RNAnimated.sequence([
        RNAnimated.timing(a, { toValue: 1, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: -1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: 1, duration: 110, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: -0.5, duration: 100, useNativeDriver: true }),
        RNAnimated.timing(a, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  }, [active, a]);
  return (
    <RNAnimated.View style={{ transform: [{ rotate: a.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] }) }] }}>
      {children}
    </RNAnimated.View>
  );
}

/* attachment renderer — image / document / product card (ported from renderShopAttachment) */
function AttachmentView({ msg, mine }) {
  const isImage = msg.attachment_type === 'image' || (!msg.attachment_type && msg.image_url);
  const url = msg.attachment_url || msg.image_url;
  if (isImage && url) {
    return <Image source={{ uri: img(url) }} style={at.image} resizeMode="cover" />;
  }
  if (msg.attachment_type === 'document' && msg.attachment_url) {
    return (
      <TouchableOpacity onPress={() => Linking.openURL(img(msg.attachment_url)).catch(() => {})}
        style={[at.doc, mine ? { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Ionicons name="document-text" size={17} color={mine ? colors.white : colors.textSecondary} />
        <Text style={[at.docName, { color: mine ? colors.white : colors.text }]} numberOfLines={1}>{msg.attachment_name || 'Document'}</Text>
      </TouchableOpacity>
    );
  }
  if (msg.attachment_type === 'product' && msg.product_snapshot) {
    const p = msg.product_snapshot;
    return (
      <View style={[at.product, mine ? { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        {p.image ? <Image source={{ uri: img(p.image) }} style={at.prodImg} /> : (
          <View style={[at.prodImg, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="bag-handle" size={16} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[at.prodName, { color: mine ? colors.white : colors.text }]} numberOfLines={1}>{p.name}</Text>
          <Text style={[at.prodPrice, { color: mine ? 'rgba(255,255,255,0.9)' : '#059669' }]}>${p.price}</Text>
        </View>
      </View>
    );
  }
  return null;
}
const at = StyleSheet.create({
  image: { width: 190, height: 160, borderRadius: 12, marginBottom: 5, backgroundColor: 'rgba(0,0,0,0.1)' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 5 },
  docName: { fontFamily: fonts.medium, fontSize: 11.5, maxWidth: 160 },
  product: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.sm, padding: 8, marginBottom: 5, minWidth: 170 },
  prodImg: { width: 42, height: 42, borderRadius: 9 },
  prodName: { fontFamily: fonts.bold, fontSize: 11.5, maxWidth: 140 },
  prodPrice: { fontFamily: fonts.extrabold, fontSize: 11.5, marginTop: 1 },
});

export default function ShopMessagesScreen() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [shopProducts, setShopProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // long-press context menu target
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try { const { data } = await api.messages.getConversations(); setConversations(data.conversations || []); } catch {}
  }, []);
  const fetchConversationMessages = useCallback(async (conversationId) => {
    try { const { data } = await api.messages.getConversation(conversationId); setMessages(data.messages || []); } catch {}
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  // poll the open thread like the consumer messenger
  useEffect(() => {
    if (!selectedConversation) return;
    const t = setInterval(() => fetchConversationMessages(selectedConversation.conversation_id), 4000);
    return () => clearInterval(t);
  }, [selectedConversation, fetchConversationMessages]);
  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchConversationMessages(conversation.conversation_id);
  };

  const handleSendReply = async (attachment = null) => {
    if (!newMessage.trim() && !attachment) return;
    if (!selectedConversation) return;
    const payload = {
      recipient_id: selectedConversation.other_party.id,
      recipient_type: selectedConversation.other_party.type,
      message: newMessage || '',
    };
    if (attachment?.type === 'image') {
      payload.attachment_type = 'image'; payload.attachment_url = attachment.url; payload.image_url = attachment.url;
    } else if (attachment?.type === 'product') {
      payload.product_id = attachment.product_id;
    }
    try {
      await api.messages.send(payload);
      setNewMessage('');
      fetchConversationMessages(selectedConversation.conversation_id);
      fetchConversations();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to send message');
    }
  };

  /* image attachment via native picker + attachment upload endpoint */
  const handleAttachImage = async () => {
    const res = await pickImage({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const { data } = await api.messages.uploadAttachment({ uri: asset.uri, name: asset.fileName || 'photo.jpg', mimeType: asset.mimeType });
      if (data.url) handleSendReply({ type: 'image', url: data.url });
      else toast.error('Upload failed');
    } catch (e) { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const openProductPicker = async () => {
    setProductPickerOpen(true);
    if (!productsLoaded) {
      try {
        const { data } = await api.shop.getProducts();
        setShopProducts(Array.isArray(data) ? data : (data.products || []));
        setProductsLoaded(true);
      } catch (e) { setShopProducts([]); }
    }
  };
  const handleSendProduct = (product) => {
    setProductPickerOpen(false);
    handleSendReply({ type: 'product', product_id: product.id });
  };

  const submitEdit = async () => {
    const t = editText.trim(); if (!t) return;
    try {
      await api.messages.edit(editingId, t);
      setEditingId(null); setEditText('');
      if (selectedConversation) fetchConversationMessages(selectedConversation.conversation_id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to edit message'); }
  };
  const removeMsg = async (m) => {
    setMenuFor(null);
    try {
      await api.messages.remove(m.id);
      if (selectedConversation) fetchConversationMessages(selectedConversation.conversation_id);
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete message'); }
  };

  const handleComposeMessage = async () => {
    if (!composeMessage.trim()) { toast.error('Message cannot be empty'); return; }
    try {
      await api.messages.send({ recipient_id: 'admin', recipient_type: 'admin', subject: composeSubject, message: composeMessage });
      setComposeOpen(false); setComposeSubject(''); setComposeMessage('');
      fetchConversations();
      toast.success('Message sent to admin!');
    } catch (error) { toast.error('Failed to send message'); }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_party.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ============ conversation list ============ */
  if (!selectedConversation) {
    return (
      <View style={{ flex: 1, backgroundColor: shop.bg }} testID="shop-messages-content">
        <View style={st.listHead}>
          <Text style={st.listTitle} testID="shop-messages-title">Messages</Text>
          <PressScale onPress={() => setComposeOpen(true)}>
            <LinearGradient colors={EMERALD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.adminBtn}>
              <Ionicons name="send" size={12} color={colors.white} />
              <Text style={st.adminBtnText}>Contact Admin</Text>
            </LinearGradient>
          </PressScale>
        </View>
        <View style={st.search}>
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search..."
            placeholderTextColor={colors.textMuted} style={st.searchInput} />
        </View>
        <FlatList
          data={filteredConversations}
          keyExtractor={(c) => c.conversation_id}
          contentContainerStyle={{ paddingBottom: TAB_SPACE, paddingTop: 4 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <View style={st.emptyIcon}><Ionicons name="chatbubble-ellipses" size={30} color="#34d399" /></View>
              <Text style={st.emptyTitle}>No conversations yet</Text>
              <Text style={st.emptySub}>Send a message to admin to start</Text>
            </View>
          }
          renderItem={({ item: conv, index }) => (
            <Rise delay={Math.min(400, index * 50)} distance={12}>
              <TouchableOpacity onPress={() => handleSelectConversation(conv)} activeOpacity={0.75} style={st.convRow}>
                <View style={[st.convAvatar, { backgroundColor: conv.other_party.type === 'admin' ? colors.p100 : '#d1fae5' }]}>
                  <Ionicons name={conv.other_party.type === 'admin' ? 'shield-checkmark' : 'person'} size={16}
                    color={conv.other_party.type === 'admin' ? colors.p500 : '#059669'} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[st.convName, conv.unread_count > 0 && { fontFamily: fonts.extrabold, color: colors.ink }]} numberOfLines={1}>{conv.other_party.name}</Text>
                    <Text style={st.convTime}>{formatTime(conv.last_message_time)}</Text>
                  </View>
                  {conv.subject ? <Text style={st.convSubject} numberOfLines={1}>{conv.subject}</Text> : null}
                  <Text style={st.convLast} numberOfLines={1}>{conv.last_message}</Text>
                </View>
                {conv.unread_count > 0 && (
                  <View style={st.unreadBadge}><Text style={st.unreadText}>{conv.unread_count}</Text></View>
                )}
              </TouchableOpacity>
            </Rise>
          )}
        />

        {/* Contact admin compose */}
        <Modal visible={composeOpen} transparent animationType="fade" onRequestClose={() => setComposeOpen(false)}>
          <BlurView intensity={24} tint="dark" style={st.backdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setComposeOpen(false)} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={st.dialog}>
                <Text style={st.dialogTitle}>Message Admin</Text>
                <Text style={st.label}>Subject</Text>
                <TextInput value={composeSubject} onChangeText={setComposeSubject} placeholder="Optional subject..."
                  placeholderTextColor={colors.textMuted} style={st.input} />
                <Text style={st.label}>Message *</Text>
                <TextInput value={composeMessage} onChangeText={setComposeMessage} placeholder="Type your message..." multiline
                  placeholderTextColor={colors.textMuted} style={[st.input, { height: 96, textAlignVertical: 'top' }]} />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <PressScale style={{ flex: 1 }} onPress={handleComposeMessage}>
                    <LinearGradient colors={EMERALD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.sendComposeBtn}>
                      <Ionicons name="send" size={13} color={colors.white} />
                      <Text style={st.adminBtnText}>Send</Text>
                    </LinearGradient>
                  </PressScale>
                  <PressScale style={{ flex: 1 }} onPress={() => setComposeOpen(false)}>
                    <View style={st.outlineBtn}><Text style={st.outlineText}>Cancel</Text></View>
                  </PressScale>
                </View>
              </View>
            </KeyboardAvoidingView>
          </BlurView>
        </Modal>
        <ToastHost />
      </View>
    );
  }

  /* ============ chat thread ============ */
  const other = selectedConversation.other_party;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }}>
      {/* thread header */}
      <View style={st.chatHead}>
        <TouchableOpacity onPress={() => { setSelectedConversation(null); setMessages([]); fetchConversations(); }} style={st.chatBack}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={[st.convAvatar, { backgroundColor: other.type === 'admin' ? colors.p100 : '#d1fae5', width: 34, height: 34 }]}>
          <Ionicons name={other.type === 'admin' ? 'shield-checkmark' : 'person'} size={15} color={other.type === 'admin' ? colors.p500 : '#059669'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.chatName} numberOfLines={1}>{other.name}</Text>
          <Text style={st.chatType}>{other.type}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => m.id || String(i)}
          contentContainerStyle={{ padding: 14, gap: 9, flexGrow: 1, justifyContent: 'flex-end' }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: msg }) => {
            const mine = msg.sender_type === 'shop';
            const isEditing = editingId === msg.id;
            const bubble = (
              <Wiggle active={isEditing}>
                {mine ? (
                  <LinearGradient colors={EMERALD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.bubble, st.bubbleMine]}>
                    <BubbleContent msg={msg} mine isEditing={isEditing} editText={editText} setEditText={setEditText}
                      submitEdit={submitEdit} cancelEdit={() => { setEditingId(null); setEditText(''); }} />
                  </LinearGradient>
                ) : (
                  <View style={[st.bubble, st.bubbleThem]}>
                    <BubbleContent msg={msg} mine={false} isEditing={false} />
                  </View>
                )}
              </Wiggle>
            );
            return (
              <Animated.View layout={LinearTransition.springify().damping(18)} entering={FadeIn} exiting={FadeOut.duration(360)}
                style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                {mine && !msg.is_deleted && !isEditing ? (
                  <TouchableOpacity activeOpacity={0.85}
                    onLongPress={() => { tapMedium(); setMenuFor(msg); }}
                    delayLongPress={280}>
                    {bubble}
                  </TouchableOpacity>
                ) : bubble}
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 8 }}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
              <Text style={st.emptySub}>Say hello 👋</Text>
            </View>
          }
        />

        {/* input bar: photo + product + text + send */}
        <View style={st.inputBar}>
          <TouchableOpacity onPress={handleAttachImage} disabled={uploading} style={st.attachBtn}>
            {uploading ? <Spinner size={17} color="#059669" /> : <Ionicons name="image" size={20} color={colors.textMuted} />}
          </TouchableOpacity>
          {other.type !== 'admin' && (
            <TouchableOpacity onPress={openProductPicker} style={st.attachBtn}>
              <Ionicons name="bag-handle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={st.inputWrap}>
            <TextInput style={st.chatInput} placeholder="Type a message..." placeholderTextColor={colors.textMuted}
              value={newMessage} onChangeText={setNewMessage} multiline />
          </View>
          <TouchableOpacity onPress={() => handleSendReply()} disabled={!newMessage.trim() && !uploading} activeOpacity={0.9}>
            <LinearGradient colors={EMERALD} style={[st.sendBtn, !newMessage.trim() && { opacity: 0.5 }]}>
              <Ionicons name="send" size={17} color={colors.white} />
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

      {/* product picker — attach-a-product cards */}
      <Modal visible={productPickerOpen} transparent animationType="fade" onRequestClose={() => setProductPickerOpen(false)}>
        <BlurView intensity={24} tint="dark" style={st.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setProductPickerOpen(false)} />
          <View style={[st.dialog, { maxHeight: 520 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <Ionicons name="bag-handle" size={17} color="#059669" />
              <Text style={st.dialogTitle}>Share a Product</Text>
            </View>
            {shopProducts.length === 0 ? (
              <Text style={[st.emptySub, { textAlign: 'center', paddingVertical: 30 }]}>{productsLoaded ? 'No products to share.' : 'Loading…'}</Text>
            ) : (
              <FlatList
                data={shopProducts}
                keyExtractor={(p) => p.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 9 }}
                contentContainerStyle={{ gap: 9 }}
                style={{ maxHeight: 420 }}
                renderItem={({ item: p }) => (
                  <TouchableOpacity onPress={() => handleSendProduct(p)} activeOpacity={0.8} style={st.pickCard}>
                    {(p.image || p.images?.[0]) ? (
                      <Image source={{ uri: img(p.image || p.images[0]) }} style={st.pickImg} />
                    ) : (
                      <View style={[st.pickImg, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="bag-handle" size={20} color={colors.border} />
                      </View>
                    )}
                    <Text style={st.pickName} numberOfLines={1}>{p.name}</Text>
                    <Text style={st.pickPrice}>${Number(p.discount_price || p.price || 0).toFixed(2)}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </BlurView>
      </Modal>
      <ToastHost />
    </View>
  );
}

/* bubble internals: attachment + text or the in-place editor */
function BubbleContent({ msg, mine, isEditing, editText, setEditText, submitEdit, cancelEdit }) {
  if (msg.is_deleted) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name="trash" size={11} color={mine ? '#a7f3d0' : colors.textMuted} />
        <Text style={{ fontFamily: fonts.body, fontSize: 13, fontStyle: 'italic', color: mine ? '#a7f3d0' : colors.textMuted }}>message deleted</Text>
      </View>
    );
  }
  if (isEditing) {
    return (
      <View style={{ minWidth: 190, gap: 7 }}>
        <TextInput value={editText} onChangeText={setEditText} autoFocus multiline
          style={bc.editInput} placeholderTextColor={colors.textMuted} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
          <TouchableOpacity onPress={cancelEdit}><Text style={bc.editCancel}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={submitEdit} style={bc.editSave}><Text style={bc.editSaveText}>Save</Text></TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <>
      <AttachmentView msg={msg} mine={mine} />
      {msg.message && msg.message !== '(photo)' ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: mine ? colors.white : colors.text }}>{msg.message}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <Ionicons name="time-outline" size={9} color={mine ? '#a7f3d0' : colors.textMuted} />
        <Text style={{ fontFamily: fonts.body, fontSize: 9.5, color: mine ? '#a7f3d0' : colors.textMuted }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {msg.is_edited && !msg.is_deleted ? (
          <Text style={{ fontFamily: fonts.body, fontSize: 9.5, fontStyle: 'italic', color: mine ? '#a7f3d0' : colors.textMuted }}>· edited</Text>
        ) : null}
        {mine ? <Ionicons name="checkmark-done" size={12} color="#a7f3d0" style={{ marginLeft: 2 }} /> : null}
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
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  listTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8, ...shop.emeraldGlow },
  adminBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, margin: 12, marginBottom: 6 },
  searchInput: { flex: 1, paddingVertical: 9, fontFamily: fonts.body, fontSize: 13, color: colors.text },
  convRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  convAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  convName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, flexShrink: 1 },
  convTime: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginLeft: 8 },
  convSubject: { fontFamily: fonts.semibold, fontSize: 11, color: '#059669', marginTop: 1 },
  convLast: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  unreadBadge: { minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textSecondary },
  emptySub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderLight, paddingHorizontal: 12, paddingVertical: 10 },
  chatBack: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderLight },
  chatName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  chatType: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textTransform: 'capitalize' },
  bubble: { maxWidth: 300, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { borderBottomRightRadius: 5, ...shop.emeraldGlow },
  bubbleThem: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
  attachBtn: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, maxHeight: 105, justifyContent: 'center' },
  chatInput: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: 9 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', ...shop.emeraldGlow },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 16 },
  menuSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14, ...shadow.dropdown },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 17, paddingVertical: 15 },
  menuText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.borderLight },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 17, ...shadow.dropdown },
  dialogTitle: { fontFamily: fonts.extrabold, fontSize: 16.5, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.body, fontSize: 13.5, color: colors.text },
  sendComposeBtn: { height: 44, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  outlineBtn: { height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  pickCard: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 8 },
  pickImg: { width: '100%', height: 86, borderRadius: 9, backgroundColor: colors.surfaceMuted, marginBottom: 6 },
  pickName: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text },
  pickPrice: { fontFamily: fonts.extrabold, fontSize: 11.5, color: '#059669', marginTop: 1 },
});
