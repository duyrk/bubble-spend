// Settings row — label + value + optional right control with 0.5px theme-aware divider.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';

interface SettingsRowProps {
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  isLast?: boolean;
}

export function SettingsRow({ label, description, value, onPress, right, isLast }: SettingsRowProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const divider = resolvedTheme === 'light' ? 'rgba(13,13,20,0.07)' : 'rgba(255,255,255,0.06)';
  const pressedBg = resolvedTheme === 'light' ? 'rgba(13,13,20,0.04)' : 'rgba(255,255,255,0.05)';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomWidth: 0.5, borderBottomColor: divider },
        pressed && onPress ? { backgroundColor: pressedBg } : null,
      ]}
    >
      <View style={styles.leftCol}>
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.text.secondary }]}>{description}</Text>
        ) : null}
      </View>
      <View style={styles.rightCol}>
        {value ? <Text style={[styles.value, { color: colors.text.secondary }]}>{value}</Text> : null}
        {right}
        {onPress && !right ? (
          <Text style={[styles.chevron, { color: colors.text.tertiary }]}>›</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  value: {
    fontSize: 14,
  },
  chevron: {
    fontSize: 20,
    marginLeft: 2,
  },
});
