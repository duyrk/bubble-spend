// Custom floating Liquid Glass tab bar — replaces the default Expo Router tab bar.
// Pill-shaped surface, accent dot indicator, icon scale bounce on tab change.

import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/useUIStore';
import { BLUR, RADII, SPRING } from '@/constants/theme';

const TAB_ICONS: Record<string, string> = {
  index: '⬡',
  history: '☰',
  settings: '◎',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const activeModal = useUIStore((s) => s.activeModal);

  if (activeModal !== null) return null;

  // iOS uses a real BlurView; Android needs a solid surface tint
  const iosWrapperBg =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.62)' : 'rgba(17,17,28,0.62)';
  const wrapperBg = Platform.OS === 'android' ? colors.bg.elevated : iosWrapperBg;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 16 }]}>
      <View
        style={[
          styles.barWrapper,
          { backgroundColor: wrapperBg, borderColor: colors.glass.border },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={BLUR.tabBar}
            tint={resolvedTheme}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.barInner}>
          <View
            style={[styles.shimmer, { backgroundColor: colors.glass.highlight }]}
            pointerEvents="none"
          />
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TabButton
                key={route.key}
                icon={TAB_ICONS[route.name] ?? '•'}
                label={label}
                focused={isFocused}
                onPress={onPress}
                activeColor={colors.accent}
                inactiveIconColor={colors.text.secondary}
                inactiveLabelColor={colors.text.tertiary}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface TabButtonProps {
  icon: string;
  label: string;
  focused: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveIconColor: string;
  inactiveLabelColor: string;
}

function TabButton({
  icon,
  label,
  focused,
  onPress,
  activeColor,
  inactiveIconColor,
  inactiveLabelColor,
}: TabButtonProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.15, SPRING.micro, () => {
        scale.value = withSpring(1, SPRING.micro);
      });
    }
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.tab} hitSlop={6}>
      <Animated.Text
        style={[styles.icon, iconStyle, { color: focused ? activeColor : inactiveIconColor }]}
      >
        {icon}
      </Animated.Text>
      <Text style={[styles.label, { color: focused ? activeColor : inactiveLabelColor }]}>
        {label}
      </Text>
      <View
        style={[
          styles.indicator,
          { backgroundColor: focused ? activeColor : 'transparent' },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  barWrapper: {
    borderRadius: RADII.pill,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
    minWidth: 78,
  },
  icon: {
    fontSize: 18,
    lineHeight: 20,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  indicator: {
    marginTop: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
