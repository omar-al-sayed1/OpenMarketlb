import * as Haptics from 'expo-haptics';

// Thin wrappers — never throw (haptics can be unavailable on some devices/emulators).
export const tapLight = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {} };
export const tapMedium = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {} };
export const notifySuccess = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {} };
export const notifyError = () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (_) {} };
