// Persisted settings: theme, language, currency, notifications

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
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
  // Transient (never persisted): true once AsyncStorage has rehydrated. Gates
  // first-paint logic like the onboarding overlay so it doesn't act on defaults.
  _hasHydrated: boolean;

  setTheme: (theme: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderTime: (hour: number, minute: number) => void;
  completeOnboarding: () => void;
  setHasHydrated: (hydrated: boolean) => void;
};

function detectDefaultLanguage(): Language {
  const locale = Localization.getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as Language)
    : 'en';
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
      _hasHydrated: false,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setReminderTime: (reminderHour, reminderMinute) => set({ reminderHour, reminderMinute }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),
    }),
    {
      name: 'bubble-spend-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only real settings — never the transient hydration flag.
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        currency: s.currency,
        notificationsEnabled: s.notificationsEnabled,
        reminderHour: s.reminderHour,
        reminderMinute: s.reminderMinute,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
      }),
      // Flip the gate once AsyncStorage has loaded so the onboarding overlay
      // doesn't flash for returning users before their flag is read back.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
