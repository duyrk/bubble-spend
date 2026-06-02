// Daily reminder scheduling via expo-notifications

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TRANSLATIONS } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

const REMINDER_ID = 'bubble-spend-daily-reminder';

const REMINDER_BODY: Record<Language, { title: string; body: string }> = {
  en: {
    title: 'A quick check-in',
    body: 'Take a moment to log today\'s spending.',
  },
  vi: {
    title: 'Ghi lại chi tiêu nào',
    body: 'Dành vài giây để ghi lại các khoản chi hôm nay.',
  },
};

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  language: Language,
): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelDailyReminder();

  const content = REMINDER_BODY[language];
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: content.title,
      body: content.body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // Reminder wasn't scheduled — safe to ignore
  }
}

// Configure foreground notification behavior — call once at app startup
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
