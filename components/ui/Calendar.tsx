// Lightweight month-grid date picker — pure RN Views, Monday-first weeks
// (matches the app's week period). Days after `maxDate` are disabled. Month and
// weekday names come from the i18n dates module (no Intl, for Hermes safety).

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useTheme';
import {
  WEEKDAYS_SHORT,
  formatMonthYear,
  isSameDay,
  startOfDay,
} from '@/lib/i18n';
import type { Language } from '@/lib/i18n';

interface CalendarProps {
  selected: Date;
  onSelect: (date: Date) => void;
  language: Language;
  // Latest selectable day (inclusive). Defaults to today.
  maxDate?: Date;
}

export function Calendar({ selected, onSelect, language, maxDate }: CalendarProps) {
  const colors = useColors();
  const today = startOfDay(new Date());
  const max = startOfDay(maxDate ?? new Date());

  // The month on screen (1st of month). Opens on the selected date's month.
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    // Monday-first leading blanks: JS getDay() 0=Sun..6=Sat → Mon=0..Sun=6.
    const leading = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth]);

  // Never page into a month entirely past the max (future) bound.
  const canNext =
    viewMonth.getFullYear() < max.getFullYear() ||
    (viewMonth.getFullYear() === max.getFullYear() &&
      viewMonth.getMonth() < max.getMonth());

  const goPrev = () => {
    Haptics.selectionAsync();
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (!canNext) return;
    Haptics.selectionAsync();
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={goPrev} hitSlop={10} style={styles.navBtn}>
          <Text style={[styles.nav, { color: colors.text.secondary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.month, { color: colors.text.primary }]}>
          {formatMonthYear(viewMonth, language)}
        </Text>
        <Pressable
          onPress={goNext}
          hitSlop={10}
          disabled={!canNext}
          style={styles.navBtn}
        >
          <Text
            style={[
              styles.nav,
              { color: canNext ? colors.text.secondary : colors.text.tertiary },
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS_SHORT[language].map((w, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.text.tertiary }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={i} style={styles.cell} />;
          const disabled = date.getTime() > max.getTime();
          const isSelected = isSameDay(date, selected);
          const isToday = isSameDay(date, today);
          return (
            <Pressable
              key={i}
              disabled={disabled}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(date);
              }}
              style={styles.cell}
            >
              <View
                style={[
                  styles.dayPill,
                  isSelected && { backgroundColor: colors.accent },
                  isToday &&
                    !isSelected && {
                      borderWidth: 1,
                      borderColor: colors.glass.borderStrong,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: disabled
                        ? colors.text.tertiary
                        : isSelected
                          ? '#fff'
                          : colors.text.primary,
                      fontWeight: isSelected || isToday ? '700' : '500',
                    },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nav: {
    fontSize: 24,
    fontWeight: '400',
  },
  month: {
    fontSize: 15,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 15,
  },
});
