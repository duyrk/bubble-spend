// Custom floating Liquid Glass tab bar — replaces the default Expo Router tab bar.
// Pill-shaped GlassSurface, accent dot indicator, icon scale bounce on tab change.

import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/useUIStore';
import { BLUR, RADII, SPRING } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';

type FeatherIconName = ComponentProps<typeof Feather>['name'];

const TAB_ICONS: Record<string, FeatherIconName> = {
  index: 'hexagon',
  history: 'list',
  settings: 'settings',
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const activeModal = useUIStore((s) => s.activeModal);
  const numpadEditing = useUIStore((s) => s.numpadEditing);

  // Hide the bar whenever any numpad sheet is up — the create flow (activeModal)
  // or the History edit flow (numpadEditing) — so it never overlaps the sheet.
  if (activeModal !== null || numpadEditing) return null;

  // Kept translucent enough that the blur reads through — a near-opaque tint
  // flattens the glass into a plain milky pill.
  const surfaceTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,28,0.45)';
  const rimColor =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.18)';
  const inactiveIcon =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.40)' : 'rgba(255,255,255,0.35)';
  const inactiveLabel =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.30)' : 'rgba(255,255,255,0.30)';

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 16 }]}>
      <GlassSurface
        intensity={BLUR.tabBar}
        borderRadius={RADII.pill}
        surfaceTint={surfaceTint}
        shimmer={false}
        style={styles.barWrapper}
      >
        {/* Top rim highlight — single 1px line for the lit edge */}
        <View pointerEvents="none" style={[styles.rim, { backgroundColor: rimColor }]} />
        <View style={styles.barInner}>
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
                icon={TAB_ICONS[route.name] ?? 'circle'}
                label={label}
                focused={isFocused}
                onPress={onPress}
                activeColor={colors.accent}
                inactiveIconColor={inactiveIcon}
                inactiveLabelColor={inactiveLabel}
              />
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

interface TabButtonProps {
  icon: FeatherIconName;
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
      <Animated.View style={[styles.icon, iconStyle]}>
        <Feather
          name={icon}
          size={20}
          color={focused ? activeColor : inactiveIconColor}
        />
      </Animated.View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 32,
    right: 32,
    height: 1,
    zIndex: 2,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
    minWidth: 78,
  },
  icon: {
    marginBottom: 3,
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
