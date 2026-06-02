// Root layout — initializes database, configures notifications, applies theme.

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { configureNotificationHandler } from '@/lib/notifications';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

configureNotificationHandler();

export default function RootLayout() {
  const load = useCategoryStore((s) => s.load);
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    load();
  }, [load]);

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
