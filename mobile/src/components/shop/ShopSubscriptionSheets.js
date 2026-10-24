import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, shop, radius, fonts, shadow } from '../../theme/theme';
import { PressScale, Spinner } from './ShopKit';

/**
 * Native ports of components/ShopSubscriptionDialogs.js:
 *   SubscribeConfirmSheet · SubscribedWelcomeSheet · FirstLoginWelcomeSheet
 */

// Fallback so subscription benefits always render even if the admin-configured
// list hasn't loaded yet.
const FALLBACK_FEATURES = [
  '1 free Lucky Spin every month',
  '2 free product sponsor credits every month',
  'Lower commission on your sales',
  'Full storefront theme customisation',
  'Marketing & boost tools + advanced analytics',
  'Priority customer support',
];

const FeatureList = ({ features = [], tone = 'emerald' }) => {
  const list = (Array.isArray(features) && features.length > 0) ? features : FALLBACK_FEATURES;
  const white = tone === 'white';
  return (
    <View style={{ gap: 8 }}>
      {list.map((f, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={[fl.dot, { backgroundColor: white ? 'rgba(255,255,255,0.25)' : '#d1fae5' }]}>
            <Ionicons name="checkmark" size={10} color={white ? colors.white : '#059669'} />
          </View>
          <Text style={[fl.text, { color: white ? 'rgba(255,255,255,0.9)' : colors.text }]}>{f}</Text>
        </View>
      ))}
    </View>
  );
};
const fl = StyleSheet.create({
  dot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});

function Sheet({ open, onClose, children }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={26} tint="dark" style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>{children}</View>
      </BlurView>
    </Modal>
  );
}

/* Centered confirmation before a shop subscribes from the dashboard. */
export function SubscribeConfirmSheet({ open, onOpenChange, planName = 'Subscription', price = 0, walletBalance = 0, features = [], onConfirm, loading }) {
  const enough = walletBalance >= price;
  return (
    <Sheet open={open} onClose={() => { if (!loading) onOpenChange(false); }}>
      <LinearGradient colors={shop.plan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
        <View style={styles.headIconSq}><Ionicons name="ribbon" size={28} color={colors.white} /></View>
        <Text style={styles.headTitle}>Subscribe to {planName}?</Text>
        <Text style={styles.headSub}>${price.toFixed(2)}/month — paid from your wallet</Text>
      </LinearGradient>
      <ScrollView style={{ maxHeight: 380 }}>
        <View style={{ padding: 18, gap: 14 }}>
          <View>
            <Text style={styles.caps}>What you'll unlock</Text>
            <FeatureList features={features} />
          </View>
          <View style={[styles.walletRow, { backgroundColor: enough ? '#ecfdf5' : '#fef2f2' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="wallet" size={15} color={enough ? '#047857' : '#b91c1c'} />
              <Text style={[styles.walletLabel, { color: enough ? '#047857' : '#b91c1c' }]}>Wallet balance</Text>
            </View>
            <Text style={[styles.walletVal, { color: enough ? '#047857' : '#b91c1c' }]}>${walletBalance.toFixed(2)}</Text>
          </View>
          {!enough && <Text style={styles.notEnough}>You need ${price.toFixed(2)} to subscribe. Add funds to your wallet first.</Text>}
        </View>
      </ScrollView>
      <View style={styles.actions}>
        <PressScale style={{ flex: 1 }} onPress={() => onOpenChange(false)} disabled={loading}>
          <View style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></View>
        </PressScale>
        <PressScale style={{ flex: 1 }} onPress={onConfirm} disabled={loading || !enough}>
          <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.confirmBtn, (loading || !enough) && { opacity: 0.6 }]} testID="confirm-subscribe-btn">
            {loading ? <Spinner size={14} /> : <Ionicons name="ribbon" size={14} color={colors.white} />}
            <Text style={styles.confirmText}>Confirm & Subscribe</Text>
          </LinearGradient>
        </PressScale>
      </View>
    </Sheet>
  );
}

/* Shown right after a successful subscribe — welcome + benefits. */
export function SubscribedWelcomeSheet({ open, onOpenChange, planName = 'Subscription', features = [] }) {
  return (
    <Sheet open={open} onClose={() => onOpenChange(false)}>
      <LinearGradient colors={['#10b981', '#14b8a6', '#0891b2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
        <View style={styles.headIconRound}><Ionicons name="balloon" size={30} color={colors.white} /></View>
        <Text style={[styles.headTitle, { fontSize: 22 }]}>You're subscribed! 🎉</Text>
        <Text style={styles.headSub}>Welcome to {planName}. Here's everything you now get:</Text>
      </LinearGradient>
      <ScrollView style={{ maxHeight: 360 }}>
        <View style={{ padding: 18 }}><FeatureList features={features} /></View>
      </ScrollView>
      <View style={[styles.actions, { paddingTop: 0 }]}>
        <PressScale style={{ flex: 1 }} onPress={() => onOpenChange(false)}>
          <LinearGradient colors={['#10b981', '#14b8a6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.confirmBtn} testID="welcome-benefits-close">
            <Ionicons name="sparkles" size={14} color={colors.white} />
            <Text style={styles.confirmText}>Start selling</Text>
          </LinearGradient>
        </PressScale>
      </View>
    </Sheet>
  );
}

/* First-login popup. Subscribed vs. non-subscribed variant. */
export function FirstLoginWelcomeSheet({ open, onOpenChange, data }) {
  if (!data) return null;
  const subscribed = !!data.is_subscribed;
  const bonus = data.welcome_bonus || {};
  return (
    <Sheet open={open} onClose={() => onOpenChange(false)}>
      <LinearGradient colors={subscribed ? shop.plan : shop.subscribe} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
        <View style={styles.headIconRound}><Ionicons name={subscribed ? 'ribbon' : 'gift'} size={30} color={colors.white} /></View>
        <Text style={[styles.headTitle, { fontSize: 22 }]}>Welcome{data.shop_name ? `, ${data.shop_name}` : ''}! 👋</Text>
        <Text style={styles.headSub}>{subscribed ? 'Thanks for subscribing — here are your perks.' : "Here's a little gift to get you started."}</Text>
      </LinearGradient>
      <ScrollView style={{ maxHeight: 380 }}>
        <View style={{ padding: 18, gap: 14 }}>
          {/* Welcome gift (both variants received it on approval) */}
          <View style={styles.giftBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <Ionicons name="gift" size={13} color="#b45309" />
              <Text style={styles.giftCaps}>Your welcome gift</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {bonus.wallet > 0 && (
                <View style={styles.bonusChip}>
                  <Ionicons name="wallet" size={11} color="#b45309" />
                  <Text style={styles.bonusText}>+${Number(bonus.wallet).toFixed(2)} wallet credit</Text>
                </View>
              )}
              {bonus.sponsors > 0 && (
                <View style={styles.bonusChip}>
                  <Ionicons name="sparkles" size={11} color="#b45309" />
                  <Text style={styles.bonusText}>{bonus.sponsors} free product sponsor{bonus.sponsors > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </View>

          {subscribed && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <Ionicons name="ribbon" size={13} color={colors.p800} />
                <Text style={[styles.giftCaps, { color: colors.p800 }]}>{data.plan_name || 'Subscription'} perks</Text>
              </View>
              <FeatureList features={data.features} />
            </View>
          )}
        </View>
      </ScrollView>
      <View style={[styles.actions, { paddingTop: 0 }]}>
        <PressScale style={{ flex: 1 }} onPress={() => onOpenChange(false)}>
          <LinearGradient colors={subscribed ? [colors.p500, colors.s500] : ['#f59e0b', '#f97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.confirmBtn} testID="first-login-welcome-close">
            <Text style={styles.confirmText}>Let's go</Text>
          </LinearGradient>
        </PressScale>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 18 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.dropdown },
  head: { padding: 24, alignItems: 'center' },
  headIconSq: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  headIconRound: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  headTitle: { color: colors.white, fontFamily: fonts.extrabold, fontSize: 19, textAlign: 'center', letterSpacing: -0.3 },
  headSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.body, fontSize: 12.5, marginTop: 4, textAlign: 'center' },
  caps: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  walletRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, padding: 12 },
  walletLabel: { fontFamily: fonts.medium, fontSize: 13 },
  walletVal: { fontFamily: fonts.bold, fontSize: 13.5 },
  notEnough: { fontFamily: fonts.body, fontSize: 11.5, color: '#dc2626', marginTop: -6 },
  actions: { flexDirection: 'row', gap: 8, padding: 18, paddingTop: 4 },
  cancelBtn: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  confirmBtn: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  confirmText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  giftBox: { borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb', borderRadius: radius.md, padding: 12 },
  giftCaps: { fontFamily: fonts.bold, fontSize: 10.5, color: '#b45309', textTransform: 'uppercase', letterSpacing: 1 },
  bonusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderWidth: 1, borderColor: '#fde68a', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  bonusText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#b45309' },
});
