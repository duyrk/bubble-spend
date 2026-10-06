// Root layout — initializes database, configures notifications, applies theme,
// and fires due recurring-expense templates on app open.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useRecurringStore } from '@/stores/useRecurringStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { configureNotificationHandler } from '@/lib/notifications';
import { fireDueRecurringTemplates } from '@/lib/recurringIO';
import * as NotificationCapture from '@/modules/notification-capture';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

configureNotificationHandler();

// Auto-log any due recurring templates, then refresh in-memory state: the
// template list always (it doubles as the initial load, and firing stamps
// lastFiredDate), and the active period's transactions only when something was
// logged — bubble sizes and budget rings chain off HomeScreen's transactions
// effect. Runs at cold start and on every return from background, so a
// template still fires for users who never fully kill the app.
function fireRecurring() {
  const fired = fireDueRecurringTemplates();
  useRecurringStore.getState().load();
  if (fired > 0) {
    const txStore = useTransactionStore.getState();
    txStore.loadByPeriod(txStore.period);
  }
}

export default function RootLayout() {
  const load = useCategoryStore((s) => s.load);
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated);

  useEffect(() => {
    // load() runs initDb() first, so the recurring table exists before we read it.
    load();
    fireRecurring();
    // Some OEMs unbind the notification listener after the process dies — ask
    // Android to bring it back (no-op if access isn't granted / not Android).
    NotificationCapture.requestRebind();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fireRecurring();
    });
    return () => sub.remove();
  }, [load]);

  // Notification auto-capture: process whatever the Android listener queued —
  // at start, on every return to foreground, and live (debounced, since one
  // payment can fire a burst of notifications) while the app is open. Waits for
  // settings hydration because the "my accounts" list decides what's internal.
  // Declared after the effect above so initDb() has run first.
  useEffect(() => {
    if (!settingsHydrated || !NotificationCapture.isSupported) return;
    const runCapture = () => useCaptureStore.getState().run();
    runCapture();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runCapture();
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const captureSub = NotificationCapture.addCaptureListener(() => {
      clearTimeout(timer);
      timer = setTimeout(runCapture, 800);
    });
    return () => {
      clearTimeout(timer);
      appSub.remove();
      captureSub?.remove();
    };
  }, [settingsHydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.primary },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style={resolvedTheme === 'light' ? 'dark' : 'light'} />
    </GestureHandlerRootView>
  );
}
