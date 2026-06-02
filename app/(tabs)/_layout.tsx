// Tab layout — uses the custom Liquid Glass floating tab bar.

import { Tabs } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: t('history') }} />
      <Tabs.Screen name="settings" options={{ title: t('settings') }} />
    </Tabs>
  );
}
