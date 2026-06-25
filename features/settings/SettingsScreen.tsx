// Settings screen — theme, language, currency, notifications, version

import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { SettingsGroup } from './SettingsGroup';
import { SettingsRow } from './SettingsRow';
import { OptionPickerModal } from './OptionPickerModal';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCategoryStore } from '@/stores/useCategoryStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { exportData, pickBackup, applyBackup } from '@/lib/backupIO';
import { useColors } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { LANGUAGES } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';
import { CURRENCY_LIST } from '@/lib/currency';
import type { CurrencyCode } from '@/lib/currency';
import {
  ensureNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
} from '@/lib/notifications';
import type { ThemeMode } from '@/stores/useSettingsStore';

const APP_VERSION = Application.nativeApplicationVersion ?? '1.0.0';
const BUILD_VERSION = Application.nativeBuildVersion ?? '1';

type PickerKind = null | 'theme' | 'language' | 'currency' | 'reminderTime';

const REMINDER_OPTIONS: { hour: number; minute: number }[] = [
  { hour: 9, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 21, minute: 0 },
  { hour: 22, minute: 0 },
];

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { t, language: currentLanguage } = useTranslation();

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const currency = useSettingsStore((s) => s.currency);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const reminderHour = useSettingsStore((s) => s.reminderHour);
  const reminderMinute = useSettingsStore((s) => s.reminderMinute);
  const setReminderTime = useSettingsStore((s) => s.setReminderTime);

  const [picker, setPicker] = useState<PickerKind>(null);

  useEffect(() => {
    if (notificationsEnabled) {
      scheduleDailyReminder(reminderHour, reminderMinute, currentLanguage);
    }
  }, [notificationsEnabled, reminderHour, reminderMinute, currentLanguage]);

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        Alert.alert(
          t('notifications'),
          'Permission denied. Enable notifications in system settings.',
        );
        return;
      }
      await scheduleDailyReminder(reminderHour, reminderMinute, currentLanguage);
      setNotificationsEnabled(true);
    } else {
      await cancelDailyReminder();
      setNotificationsEnabled(false);
    }
  };

  // After a restore, re-read categories + the active period's transactions from
  // SQLite and re-scale the bubbles so Home/History reflect the imported data.
  const reloadAfterImport = useCallback(() => {
    useCategoryStore.getState().load();
    const period = useTransactionStore.getState().period;
    useTransactionStore.getState().loadByPeriod(period);
    useCategoryStore.getState().recalcSizes(useTransactionStore.getState().transactions);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const result = await exportData();
      if (result.status === 'empty') {
        Alert.alert(t('exportData'), t('nothingToExport'));
      }
    } catch {
      Alert.alert(t('exportData'), t('exportError'));
    }
  }, [t]);

  const handleImport = useCallback(async () => {
    // pickBackup resolves null when the user cancels, and throws (with a clear
    // message) when the chosen file isn't a valid backup. The catch maps the
    // throw to null after surfacing it, so both paths just bail below.
    const payload = await pickBackup().catch((e: unknown) => {
      Alert.alert(t('importData'), e instanceof Error ? e.message : t('importError'));
      return null;
    });
    if (!payload) return;

    Alert.alert(t('importConfirmTitle'), t('importConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('replace'),
        style: 'destructive',
        onPress: () => {
          try {
            applyBackup(payload);
            reloadAfterImport();
            Alert.alert(t('importData'), t('importSuccess'));
          } catch {
            Alert.alert(t('importData'), t('importError'));
          }
        },
      },
    ]);
  }, [t, reloadAfterImport]);

  const formatTime = (h: number, m: number) =>
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const themeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case 'dark':
        return t('themeDark');
      case 'light':
        return t('themeLight');
      case 'system':
        return t('themeSystem');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top + 8 }]}>
      <Text style={[styles.header, { color: colors.text.primary }]}>{t('settings')}</Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SettingsGroup title={t('appearance')}>
          <SettingsRow
            label={t('theme')}
            value={themeLabel(theme)}
            onPress={() => setPicker('theme')}
          />
          <SettingsRow
            label={t('language')}
            value={LANGUAGES.find((l) => l.code === language)?.nativeLabel ?? language}
            onPress={() => setPicker('language')}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup title={t('general')}>
          <SettingsRow
            label={t('currency')}
            value={currency}
            onPress={() => setPicker('currency')}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup title={t('notifications')}>
          <SettingsRow
            label={t('dailyReminder')}
            description={t('dailyReminderDesc')}
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: colors.glass.border, true: colors.accent }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            }
          />
          <SettingsRow
            label={t('reminderTime')}
            value={formatTime(reminderHour, reminderMinute)}
            onPress={notificationsEnabled ? () => setPicker('reminderTime') : undefined}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup title={t('data')}>
          <SettingsRow
            label={t('exportData')}
            description={t('exportDataDesc')}
            onPress={handleExport}
          />
          <SettingsRow
            label={t('importData')}
            description={t('importDataDesc')}
            onPress={handleImport}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup title={t('about')}>
          <SettingsRow
            label={t('appVersion')}
            value={`${APP_VERSION} (${BUILD_VERSION})`}
            isLast
          />
        </SettingsGroup>
      </ScrollView>

      <OptionPickerModal
        visible={picker === 'theme'}
        title={t('theme')}
        selected={theme}
        options={[
          { value: 'dark' as ThemeMode, label: t('themeDark') },
          { value: 'light' as ThemeMode, label: t('themeLight') },
          { value: 'system' as ThemeMode, label: t('themeSystem') },
        ]}
        onSelect={setTheme}
        onClose={() => setPicker(null)}
      />

      <OptionPickerModal
        visible={picker === 'language'}
        title={t('language')}
        selected={language}
        options={LANGUAGES.map((l) => ({
          value: l.code as Language,
          label: l.nativeLabel,
          detail: l.label !== l.nativeLabel ? l.label : undefined,
        }))}
        onSelect={setLanguage}
        onClose={() => setPicker(null)}
      />

      <OptionPickerModal
        visible={picker === 'currency'}
        title={t('currency')}
        selected={currency}
        options={CURRENCY_LIST.map((c) => ({
          value: c.code as CurrencyCode,
          label: `${c.code} ${c.symbol}`,
          detail: c.name,
        }))}
        onSelect={setCurrency}
        onClose={() => setPicker(null)}
      />

      <OptionPickerModal
        visible={picker === 'reminderTime'}
        title={t('reminderTime')}
        selected={formatTime(reminderHour, reminderMinute)}
        options={REMINDER_OPTIONS.map((opt) => ({
          value: formatTime(opt.hour, opt.minute),
          label: formatTime(opt.hour, opt.minute),
        }))}
        onSelect={(v) => {
          const [h, m] = v.split(':').map((n) => parseInt(n, 10));
          setReminderTime(h, m);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: -0.5,
  },
  scroll: {
    paddingTop: 8,
    paddingBottom: 120, // breathing room for floating tab bar
  },
});
