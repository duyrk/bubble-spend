// First-launch coaching overlay. The core bubble interactions — hold-to-drag,
// hold-again-to-delete, and the "Earned" income entry point — aren't discoverable
// on their own, so we surface them once. Gated on the persisted
// `hasCompletedOnboarding` flag, and only shown after settings have hydrated so
// returning users never see a flash.

import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { BLUR } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import type { TranslationKey } from '@/lib/i18n';

const TIPS: { emoji: string; title: TranslationKey; desc: TranslationKey }[] = [
  { emoji: '👆', title: 'onboardingTapTitle', desc: 'onboardingTapDesc' },
  { emoji: '✋', title: 'onboardingHoldTitle', desc: 'onboardingHoldDesc' },
  { emoji: '🗑️', title: 'onboardingDeleteTitle', desc: 'onboardingDeleteDesc' },
  { emoji: '💰', title: 'onboardingIncomeTitle', desc: 'onboardingIncomeDesc' },
];

export function OnboardingOverlay() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();

  const hydrated = useSettingsStore((s) => s._hasHydrated);
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const visible = hydrated && !hasCompletedOnboarding;

  const dismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    completeOnboarding();
  }, [completeOnboarding]);

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.86)' : 'rgba(17,17,28,0.86)';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <GlassSurface
          intensity={BLUR.modal}
          borderRadius={28}
          surfaceTint={sheetTint}
          shimmer
          style={styles.card}
        >
          <View style={styles.cardInner}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {t('onboardingTitle')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
              {t('onboardingSubtitle')}
            </Text>

            <View style={styles.tips}>
              {TIPS.map((tip) => (
                <View key={tip.title} style={styles.tipRow}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: colors.glass.base, borderColor: colors.glass.border },
                    ]}
                  >
                    <Text style={styles.badgeEmoji}>{tip.emoji}</Text>
                  </View>
                  <View style={styles.tipText}>
                    <Text style={[styles.tipTitle, { color: colors.text.primary }]}>
                      {t(tip.title)}
                    </Text>
                    <Text style={[styles.tipDesc, { color: colors.text.secondary }]}>
                      {t(tip.desc)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={styles.ctaText}>{t('onboardingCta')}</Text>
            </Pressable>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
  },
  cardInner: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  tips: {
    gap: 16,
    marginBottom: 24,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 20,
  },
  tipText: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  tipDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  cta: {
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
