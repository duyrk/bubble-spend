// Insight screen route — pushed from History via router.push('/insight').
// Opens with no route transition; the in-screen level navigation is a flat
// slide handled by InsightScreen's local Reanimated stack.

import { Stack } from 'expo-router';
import { InsightScreen } from '@/features/insight/InsightScreen';

export default function InsightRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
      <InsightScreen />
    </>
  );
}
