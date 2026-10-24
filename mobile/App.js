import React, { useEffect, useRef, useState, Suspense } from 'react';
import { View, Image, ActivityIndicator, Animated, Keyboard, Platform, TextInput, Appearance } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import {
  useFonts,
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  Manrope_700Bold, Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { FlyToCartProvider } from './src/context/FlyToCartContext';
import { api } from './src/lib/api';
import { img } from './src/lib/media';
import { Wordmark } from './src/components/Wordmark';
import { AlertHost } from './src/components/AppDialog';
import { colors, applyBrandColors, applyColorScheme, getScheme } from './src/theme/theme';
import './src/theme/inputStyle'; // patches <TextInput> app-wide: smaller text/placeholders + branded caret

const BRAND_CACHE_KEY = 'brand_colors_v1';
export const THEME_SCHEME_KEY = 'theme_scheme_v1'; // 'light' | 'dark' | 'system'

// Loaded lazily so its screens' StyleSheets bake AFTER admin brand colors are applied.
const RootNavigator = React.lazy(() => import('./src/navigation/RootNavigator'));

// Extend DefaultTheme so React Navigation v7's required `fonts` key is present.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.rose,
  },
};

/**
 * Global keyboard pan — makes the whole app slide up when the keyboard would
 * cover the focused input, and only by the amount actually overlapping (so it
 * never over-pans). Works in Expo Go on both platforms (unlike the native
 * softwareKeyboardLayoutMode, which only applies to custom builds).
 * Note: RN <Modal> renders in its own window, so sheets handle the keyboard
 * themselves (see components/BottomSheet.js).
 */
function KeyboardPan({ children }) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animate = (to) => Animated.timing(translateY, { toValue: to, duration: 220, useNativeDriver: true }).start();
    const GAP = 28; // clearance kept between the focused input and the keyboard top
    const onShow = (e) => {
      const kbTop = e.endCoordinates?.screenY ?? 0;
      const kbH = e.endCoordinates?.height ?? 0;
      const measure = () => {
        const focused = TextInput.State?.currentlyFocusedInput?.();
        if (focused && typeof focused.measureInWindow === 'function') {
          focused.measureInWindow((x, y, w, h) => {
            if (!w && !h) { animate(-Math.min(kbH * 0.55, 260)); return; } // measure failed → safe fallback
            const overlap = (y + h + GAP) - kbTop; // px the keyboard covers the input (+ gap)
            animate(overlap > 0 ? -overlap : 0);
          });
        } else {
          animate(-Math.min(kbH * 0.55, 260)); // fallback when the input can't be measured
        }
      };
      measure();
      // Android resizes/settles the layout a frame later — re-measure so we never under-pan.
      setTimeout(measure, 130);
    };
    const s = Keyboard.addListener(showEvt, onShow);
    // iOS fires willShow early (before the input settles); didShow re-measures. Android's
    // showEvt already IS didShow, so no second listener there.
    const cf = Platform.OS === 'ios' ? Keyboard.addListener('keyboardDidShow', onShow) : null;
    const hd = Keyboard.addListener(hideEvt, () => animate(0));
    return () => { s.remove(); if (cf) cf.remove(); hd.remove(); };
  }, [translateY]);
  return <Animated.View style={{ flex: 1, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/* Branded launch screen — shows the admin's logo photo (falls back to the wordmark). */
function Splash({ logo }) {
  const a = useRef(new Animated.Value(0)).current;
  // The backend may hand back a relative path ("/api/uploads/x.jpg") or a localhost
  // URL saved by the web admin — neither loads on a device, so resolve before use.
  const logoUri = img(logo);
  useEffect(() => { Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start(); }, [a]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <Animated.View style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] }}>
        {logoUri
          ? <Image source={{ uri: logoUri }} style={{ width: 220, height: 120 }} resizeMode="contain" />
          : <Wordmark size={38} />}
      </Animated.View>
      <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 26 }} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
    Manrope_700Bold, Manrope_800ExtraBold,
  });
  const [themeReady, setThemeReady] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null); // admin logo photo shown on the splash

  // Apply the admin-configured brand colors BEFORE the navigator (and its screens'
  // StyleSheets) load. Strategy: apply last-known colors from cache instantly (so
  // the paint is always correct offline / on slow networks), then refresh from the
  // network and re-apply + cache for next launch. applyBrandColors is idempotent.
  useEffect(() => {
    let done = false;
    let scheme = 'light'; // resolved before any apply() so dark neutrals bake into stylesheets
    const syncNav = () => {
      navTheme.colors.primary = colors.primary;
      navTheme.colors.background = colors.bg;
      navTheme.colors.card = colors.surface;
      navTheme.colors.text = colors.text;
      navTheme.colors.border = colors.border;
    };
    const apply = (primary, secondary) => {
      applyBrandColors(primary, secondary); // rebuilds from light defaults + brand
      applyColorScheme(scheme);             // then overlay dark neutrals (no-op for light)
      syncNav();
    };
    const finish = () => { if (!done) { done = true; setThemeReady(true); } };
    const timer = setTimeout(finish, 3000); // safety: never hang startup on the network
    (async () => {
      // 1) resolve the color scheme (saved preference, else follow the OS)
      try {
        const pref = await AsyncStorage.getItem(THEME_SCHEME_KEY);
        scheme = (pref === 'dark' || pref === 'light') ? pref : (Appearance.getColorScheme() || 'light');
      } catch (_) { scheme = Appearance.getColorScheme() || 'light'; }
      // 2) apply cached brand + scheme instantly
      try {
        const cached = await AsyncStorage.getItem(BRAND_CACHE_KEY);
        const c = cached ? JSON.parse(cached) : {};
        apply(c.primary, c.secondary);
        if (c.logo) setLogoUrl(c.logo); // show last-known logo instantly on the splash
      } catch (_) { apply(null, null); }
      // 3) refresh brand + logo from the network, re-apply (scheme re-asserted inside apply)
      try {
        const { data } = await api.settings.getPlatform();
        if (data?.logo_url) setLogoUrl(data.logo_url);
        if (data?.primary_color || data?.secondary_color || data?.logo_url) {
          if (data?.primary_color || data?.secondary_color) apply(data.primary_color, data.secondary_color);
          AsyncStorage.setItem(BRAND_CACHE_KEY, JSON.stringify({ primary: data.primary_color, secondary: data.secondary_color, logo: data.logo_url })).catch(() => {});
        }
      } catch (_) {}
      finish();
    })();
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded || !themeReady) {
    return <Splash logo={logoUrl} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <FlyToCartProvider>
              <NavigationContainer theme={navTheme}>
                <StatusBar style={getScheme() === 'dark' ? 'light' : 'dark'} />
                <KeyboardPan>
                  <Suspense fallback={<Splash logo={logoUrl} />}>
                    <RootNavigator />
                  </Suspense>
                </KeyboardPan>
                <AlertHost />
              </NavigationContainer>
            </FlyToCartProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
