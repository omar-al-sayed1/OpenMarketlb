import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, fonts, shadow } from '../theme/theme';
import { tapLight } from '../lib/haptics';

/**
 * Branded replacement for React Native's native Alert.
 *
 * `Alert.alert(title, message?, buttons?)` keeps the exact native signature, so call
 * sites don't change — only the import source swaps from 'react-native' to this module.
 * A single <AlertHost/> mounted at the app root renders every dialog with the app theme.
 * Calls made before the host mounts are queued and flushed once it does.
 *
 * NOTE: every color is read from `colors` at RENDER time (not baked into StyleSheet or a
 * module const) because this module is imported eagerly by App.js — reading live keeps the
 * dialog correct for the admin's brand palette and for dark mode.
 */
let emit = null;
const pending = [];

export function showAlert(title, message, buttons, options) {
  const payload = { title, message, buttons, options, key: `${Date.now()}-${Math.random()}` };
  if (emit) emit(payload); else pending.push(payload);
}

export const Alert = { alert: showAlert };

const toneOf = (buttons) => {
  const arr = Array.isArray(buttons) ? buttons : [];
  if (arr.some((b) => b?.style === 'destructive')) return 'danger';
  if (arr.some((b) => b?.style === 'cancel')) return 'confirm';
  return 'info';
};

export function AlertHost() {
  const [queue, setQueue] = useState([]);
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    emit = (p) => setQueue((q) => [...q, p]);
    if (pending.length) { setQueue((q) => [...q, ...pending]); pending.length = 0; }
    return () => { emit = null; };
  }, []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    a.setValue(0);
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
  }, [current?.key]); // eslint-disable-line

  const dismiss = useCallback((cb) => {
    Animated.timing(a, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setQueue((q) => q.slice(1));
      if (typeof cb === 'function') setTimeout(cb, 0);
    });
  }, [a]);

  if (!current) return null;

  const buttons = Array.isArray(current.buttons) && current.buttons.length ? current.buttons : [{ text: 'OK', style: 'default' }];
  const tone = toneOf(current.buttons);
  const toneTint = tone === 'danger' ? '#ef4444' : colors.p500;
  const toneSoft = tone === 'danger' ? '#fef2f2' : colors.p50;
  const toneIcon = tone === 'danger' ? 'alert' : tone === 'confirm' ? 'help-circle' : 'information-circle';

  const onBackdrop = () => { const c = buttons.find((b) => b.style === 'cancel'); dismiss(c?.onPress); };
  const press = (btn) => { tapLight(); dismiss(btn?.onPress); };
  const row = buttons.length === 2; // two buttons side by side; otherwise stack

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onBackdrop} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onBackdrop} />
        <Animated.View style={[styles.card, { backgroundColor: colors.surface, opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
          <View style={[styles.iconRing, { backgroundColor: toneSoft }]}>
            <Ionicons name={toneIcon} size={26} color={toneTint} />
          </View>
          {current.title ? <Text style={[styles.title, { color: colors.ink }]}>{current.title}</Text> : null}
          {current.message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{current.message}</Text> : null}
          <View style={[styles.btns, row && styles.btnsRow]}>
            {buttons.map((b, i) => {
              const destructive = b.style === 'destructive';
              const cancel = b.style === 'cancel';
              const primary = !destructive && !cancel;
              return (
                <TouchableOpacity key={i} activeOpacity={0.88} onPress={() => press(b)} style={[styles.btnWrap, row && { flex: 1 }]}>
                  {destructive ? (
                    <LinearGradient colors={['#f43f5e', '#e11d48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
                      <Text style={[styles.btnText, { color: colors.white }]}>{b.text}</Text>
                    </LinearGradient>
                  ) : primary ? (
                    <LinearGradient colors={[colors.p500, colors.s500]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
                      <Text style={[styles.btnText, { color: colors.white }]}>{b.text}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.btn, { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border }]}>
                      <Text style={[styles.btnText, { color: colors.textSecondary }]}>{b.text}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 22, alignItems: 'center', ...shadow.emphasis },
  iconRing: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 18, textAlign: 'center', letterSpacing: -0.3 },
  message: { fontFamily: fonts.body, fontSize: 13.5, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  btns: { width: '100%', marginTop: 20, gap: 9 },
  btnsRow: { flexDirection: 'row-reverse' },
  btnWrap: { borderRadius: radius.lg, overflow: 'hidden' },
  btn: { height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { fontFamily: fonts.bold, fontSize: 14.5 },
});
