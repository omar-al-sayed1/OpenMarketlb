import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { tapLight } from '../../lib/haptics';
import { colors, radius, fonts, shadow } from '../../theme/theme';
import { CountUp } from './ShopKit';

/**
 * Gold wallet chip for the shop top bar (port of the web navbar-wallet-btn
 * in TopNotificationBar.js). Shows the live balance; tapping it opens the
 * dropdown with the last 5 wallet transactions, exactly like the website.
 */
export default function WalletChip({ onViewAll, fetcher, label = 'Digital Wallet' }) {
  const insets = useSafeAreaInsets();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [open, setOpen] = useState(false);
  const shine = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;

  const fetchWallet = useCallback(() => {
    (fetcher || api.shopWallet.get)().then(res => {
      setBalance(res.data?.balance || 0);
      setTransactions(res.data?.transactions?.slice(0, 5) || []);
    }).catch(() => {});
  }, [fetcher]);

  // fetch on mount + poll every 30s (same cadence as the web bar)
  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 30000);
    return () => clearInterval(interval);
  }, [fetchWallet]);

  // gold shine sweep across the chip
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(2600),
    ])).start();
  }, [shine]);

  // springy dropdown entrance
  useEffect(() => {
    if (open) {
      drop.setValue(0);
      Animated.spring(drop, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
    }
  }, [open, drop]);

  const openDropdown = () => { tapLight(); fetchWallet(); setOpen(true); };

  if (balance === null) return null;

  // keep the chip narrow so the top-bar buttons always fit — full amount lives in the dropdown
  const compactBalance = balance >= 100000 ? `$${Math.round(balance / 1000)}k`
    : balance >= 1000 ? `$${(balance / 1000).toFixed(1)}k`
    : `$${balance.toFixed(2)}`;

  return (
    <>
      <TouchableOpacity onPress={openDropdown} activeOpacity={0.85} testID="navbar-wallet-btn">
        <LinearGradient colors={['#fbbf24', '#fce883', '#f59e0b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.chip}>
          {/* shine sweep */}
          <Animated.View pointerEvents="none" style={[st.shine, {
            transform: [
              { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-40, 110] }) },
              { rotate: '18deg' },
            ],
          }]} />
          <View style={st.coin}><Ionicons name="wallet" size={10} color="#78350f" /></View>
          <Text style={st.chipText} numberOfLines={1}>{compactBalance}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <Animated.View style={[st.dropdown, { top: insets.top + 56, opacity: drop, transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
            { scale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ] }]}>
            {/* Balance header — emerald-50 -> teal-50 like the web dropdown, gold accents */}
            <LinearGradient colors={['#ecfdf5', '#f0fdfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.dropHead}>
              <View style={{ flex: 1 }}>
                <Text style={st.dropKicker}>{label}</Text>
                <CountUp value={balance} prefix="$" decimals={2} style={st.dropBalance} />
              </View>
              <LinearGradient colors={['#fbbf24', '#f59e0b']} style={st.dropCoin}>
                <Ionicons name="wallet" size={20} color="#78350f" />
              </LinearGradient>
            </LinearGradient>

            {/* Last transactions */}
            {transactions.length > 0 ? (
              <ScrollView style={{ maxHeight: 220 }}>
                {transactions.map((txn, i) => (
                  <View key={txn.id || i} style={[st.txnRow, i < transactions.length - 1 && st.txnDivider]}>
                    <View style={[st.txnDot, { backgroundColor: txn.amount > 0 ? '#d1fae5' : '#ffe4e6' }]}>
                      <Ionicons name={txn.amount > 0 ? 'arrow-down' : 'arrow-up'} size={11} color={txn.amount > 0 ? '#047857' : '#e11d48'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.txnNote} numberOfLines={1}>{txn.note || (txn.type || '').replace(/_/g, ' ')}</Text>
                      <Text style={st.txnDate}>{new Date(txn.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[st.txnAmount, { color: txn.amount > 0 ? '#059669' : '#ef4444' }]}>
                      {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={{ paddingVertical: 22, alignItems: 'center' }}>
                <Text style={st.txnDate}>No transactions yet</Text>
              </View>
            )}

            {/* View all */}
            <TouchableOpacity onPress={() => { setOpen(false); onViewAll && onViewAll(); }} activeOpacity={0.8} style={st.viewAll}>
              <Text style={st.viewAllText}>View All Transactions</Text>
              <Ionicons name="arrow-forward" size={12} color="#059669" />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', maxWidth: 92,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#f59e0b', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  shine: { position: 'absolute', top: -10, bottom: -10, width: 22, backgroundColor: 'rgba(255,255,255,0.5)' },
  coin: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.extrabold, fontSize: 11, color: '#78350f', letterSpacing: -0.2, flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.3)' },
  dropdown: { position: 'absolute', right: 12, width: 290, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.dropdown },
  dropHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropKicker: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  dropBalance: { fontFamily: fonts.extrabold, fontSize: 24, color: '#059669', letterSpacing: -0.5, marginTop: 1 },
  dropCoin: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#f59e0b', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 10 },
  txnDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  txnDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txnNote: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, textTransform: 'capitalize' },
  txnDate: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  txnAmount: { fontFamily: fonts.bold, fontSize: 12.5 },
  viewAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.surfaceMuted, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: 11 },
  viewAllText: { fontFamily: fonts.semibold, fontSize: 12, color: '#059669' },
});
