import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { img } from '../lib/media';
import { StackHeader, Loading, Empty } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, radius, fonts, shadow } from '../theme/theme';

const timeAgo = (ts) => {
  if (!ts) return '';
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
};

export default function MessagesScreen({ navigation }) {
  const { isLoggedIn } = useAuth();
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    api.messages.getConversations()
      .then(({ data }) => setConvos(Array.isArray(data) ? data : data?.conversations || []))
      .catch(() => setConvos([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }}><StackHeader navigation={navigation} title="Messages" /><Loading /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader navigation={navigation} title="Messages" subtitle="Your conversations" />
      {!isLoggedIn ? (
        <Empty icon="lock-closed-outline" title="Sign in to view messages" subtitle="Log in to chat with shops and support." />
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c, i) => c.conversation_id || c.id || String(i)}
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const name = item.other_party_name || item.name || item.shop_name || 'Conversation';
            const avatar = item.other_party_avatar || item.logo || item.avatar;
            const last = item.last_message || item.preview || '';
            const unread = item.unread_count || 0;
            return (
              <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => navigation.navigate('Chat', { conversation: item, name })}>
                <View style={styles.avatar}>
                  {avatar ? <Image source={{ uri: img(avatar) }} style={{ width: '100%', height: '100%', borderRadius: 26 }} /> : <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.topRow}>
                    <Text style={[styles.name, unread > 0 && { fontFamily: fonts.extrabold }]} numberOfLines={1}>{name}</Text>
                    <Text style={styles.time}>{timeAgo(item.last_message_at || item.updated_at)}</Text>
                  </View>
                  <View style={styles.botRow}>
                    <Text style={[styles.preview, unread > 0 && { color: colors.text, fontFamily: fonts.medium }]} numberOfLines={1}>{last || 'Tap to open'}</Text>
                    {unread > 0 && <View style={styles.unreadDot}><Text style={styles.unreadText}>{unread > 9 ? '9+' : unread}</Text></View>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Empty icon="chatbubbles-outline" title="No messages yet" subtitle="Start a chat from any shop page." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Edge-to-edge, full-width rows with a divider (mirrors the web messages list — no side margins).
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { fontFamily: fonts.extrabold, color: colors.violet700, fontSize: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textMuted, marginLeft: 8 },
  botRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  unreadDot: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  unreadText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10 },
});
