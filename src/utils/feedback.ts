import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

async function triggerFallback(duration: number) {
  if (Platform.OS === 'web') return;
  Vibration.vibrate(duration);
}

export function triggerSoftFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {
    void triggerFallback(8);
  });
}

export function triggerMediumFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
    void triggerFallback(14);
  });
}

export function triggerSuccessFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    void triggerFallback(22);
  });
}
