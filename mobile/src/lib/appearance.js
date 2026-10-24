import { DevSettings } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { getScheme } from '../theme/theme';

/**
 * Appearance (light/dark) persistence + reload.
 *
 * Stylesheets bake their colors at import time, so a scheme change can't repaint the
 * running app — it takes effect on the next launch. We persist the choice, then reload:
 * Updates.reloadAsync() in a production build, DevSettings.reload() in Expo Go / dev.
 */
export const THEME_SCHEME_KEY = 'theme_scheme_v1'; // 'light' | 'dark' (absent = follow system)

export const isDark = () => getScheme() === 'dark';

export async function setScheme(scheme) {
  try {
    if (scheme === 'system') await AsyncStorage.removeItem(THEME_SCHEME_KEY);
    else await AsyncStorage.setItem(THEME_SCHEME_KEY, scheme === 'dark' ? 'dark' : 'light');
  } catch (_) {}
}

export async function reloadApp() {
  try { await Updates.reloadAsync(); }
  catch (_) { try { DevSettings.reload(); } catch (__) {} }
}
