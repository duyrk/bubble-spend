// Captured-notifications inspector (Android) — every notification the pipeline
// has processed, newest first, with its outcome (logged / waiting / skipped /
// not a transaction), so a missed or misfiled payment can be traced and real
// MoMo/ACB formats shared as parser fixtures. "Capture all apps" is a temporary
// discovery mode for finding package names — those never become transactions.

import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/db';
import { useCaptureStore } from '@/stores/useCaptureStore';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import type { TranslationKey } from '@/lib/i18n';
import type { CaptureStatus, StoredCapture } from '@/types';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { RADII } from '@/constants/theme';
import {
  addCaptureListener,
  isCaptureAll,
  peekPending,
  setCaptureAll,
} from '@/modules/notification-capture';

const STATUS_LABEL: Record<CaptureStatus, TranslationKey> = {
  logged: 'captureStatusLogged',
  pending: 'captureStatusPending',
  ignored: 'captureStatusIgnored',
  unparsed: 'captureStatusUnparsed',
};

interface CaptureDebugSheetProps {
  visible: boolean;
  onClose: () => void;
}

const formatPosted = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function CaptureDebugSheet({ visible, onClose }: CaptureDebugSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();

  const { format } = useFormatCurrency();
  const [captures, setCaptures] = useState<StoredCapture[]>([]);
  const [queued, setQueued] = useState(0);
  const [captureAll, setCaptureAllState] = useState(false);

  const refresh = useCallback(() => {
    // Process anything still queued first so the list shows outcomes.
    useCaptureStore.getState().run();
    setCaptures(db.getRecentCaptures());
    setQueued(peekPending().length);
    setCaptureAllState(isCaptureAll());
  }, []);

  useEffect(() => {
    if (!visible) return;
    refresh();
    // Live-refresh while the sheet is open (the root layout's debounced run
    // also fires; a repeat run is a no-op).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = addCaptureListener(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 1000);
    });
    return () => {
      clearTimeout(timer);
      sub?.remove();
    };
  }, [visible, refresh]);

  const handleCaptureAll = (enabled: boolean) => {
    setCaptureAll(enabled);
    setCaptureAllState(enabled);
  };

  const handleShare = () => {
    Share.share({ message: JSON.stringify(captures, null, 2) });
  };

  const sheetBg = colors.bg.elevated;
  const divider = resolvedTheme === 'light' ? 'rgba(13,13,20,0.07)' : 'rgba(255,255,255,0.06)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: sheetBg, borderColor: colors.glass.border, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {t('capturedNotifications')} ({captures.length})
              {queued > 0 ? ` · ${t('queuedCaptures')} ${queued}` : ''}
            </Text>
            <Pressable
              onPress={handleShare}
              disabled={captures.length === 0}
              hitSlop={10}
              style={({ pressed }) => [styles.iconBtn, (pressed || captures.length === 0) && { opacity: 0.5 }]}
            >
              <Feather name="share" size={17} color={colors.text.primary} />
              <Text style={[styles.iconLabel, { color: colors.text.primary }]}>{t('shareCaptures')}</Text>
            </Pressable>
          </View>

          <View style={[styles.toggleRow, { borderBottomColor: divider }]}>
            <View style={styles.rowLeft}>
              <Text style={[styles.toggleLabel, { color: colors.text.primary }]}>{t('captureAllApps')}</Text>
              <Text style={[styles.toggleDesc, { color: colors.text.secondary }]}>
                {t('captureAllAppsDesc')}
              </Text>
            </View>
            <Switch
              value={captureAll}
              onValueChange={handleCaptureAll}
              trackColor={{ false: colors.glass.border, true: colors.accent }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>

          {captures.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>{t('noCaptures')}</Text>
              <Text style={[styles.emptyHint, { color: colors.text.tertiary }]}>{t('noCapturesHint')}</Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {captures.map((c, idx) => (
                <View
                  key={c.captureId}
                  style={[
                    styles.row,
                    idx !== captures.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: divider },
                  ]}
                >
                  <View style={styles.metaRow}>
                    <Text style={[styles.pkg, { color: colors.text.accent }]} numberOfLines={1}>
                      {c.packageName}
                    </Text>
                    <Text style={[styles.time, { color: colors.text.tertiary }]}>{formatPosted(c.occurredAt)}</Text>
                  </View>
                  <Text style={[styles.capTitle, { color: colors.text.primary }]}>
                    {t(STATUS_LABEL[c.status])}
                    {c.status !== 'unparsed'
                      ? ` · ${c.direction === 'debit' ? '−' : '+'}${format(c.amount)}`
                      : ''}
                    {c.verdict?.kind === 'internal' || c.verdict?.kind === 'duplicate'
                      ? ` · ${c.verdict.kind}/${c.verdict.reason}`
                      : ''}
                  </Text>
                  <Text selectable style={[styles.capText, { color: colors.text.secondary }]}>
                    {c.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    paddingTop: 8,
    paddingHorizontal: 16,
    maxHeight: '85%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
  },
  rowLeft: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  pkg: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  time: {
    fontSize: 11,
  },
  capTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  capText: {
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 12,
  },
});
