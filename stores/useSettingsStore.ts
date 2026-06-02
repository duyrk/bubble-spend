// Persisted settings: theme, language, currency, notifications

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import type { Language } from '@/lib/i18n';
import type { CurrencyCode } from '@/lib/currency';

export type ThemeMode = 'dark' | 'light' | 'system';

type SettingsState = {
  theme: ThemeMode;
  language: Language;
  currency: CurrencyCode;
  notificationsEnabled: boolean;
  reminderHour: number; // 0-23
  reminderMinute: number; // 0-59
  hasCompletedOnboarding: boolean;

  setTheme: (theme: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderTime: (hour: number, minute: number) => void;
  completeOnboarding: () => void;
};

function detectDefaultLanguage(): Language {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  return locale === 'vi' ? 'vi' : 'en';
}

function detectDefaultCurrency(): CurrencyCode {
  const region = Localization.getLocales()[0]?.regionCode ?? '';
  switch (region) {
    case 'VN':
      return 'VND';
    case 'GB':
      return 'GBP';
    case 'JP':
      return 'JPY';
    case 'KR':
      return 'KRW';
    case 'SG':
      return 'SGD';
    case 'TH':
      return 'THB';
    default:
      // Fallback by language for EU users without region
      return Localization.getLocales()[0]?.currencyCode === 'EUR' ? 'EUR' : 'USD';
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: detectDefaultLanguage(),
      currency: detectDefaultCurrency(),
      notificationsEnabled: false,
      reminderHour: 21,
      reminderMinute: 0,
      hasCompletedOnboarding: false,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setReminderTime: (reminderHour, reminderMinute) => set({ reminderHour, reminderMinute }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'bubble-spend-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
