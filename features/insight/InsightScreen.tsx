// Insight — a full-screen year → month → week drill-down with a day-transactions
// bottom sheet. Pushed from History via router.push('/insight').
//
// Navigation between levels is a local Reanimated slide stack, not Expo Router:
// the parallax back-slide (outgoing screen drifts to -25% while the new screen
// enters from the right) needs animation control the router's stack can't give.
// A `frames` render-list (1 view normally, 2 mid-transition) keeps the OUTGOING
// screen's instance mounted so it never flashes a skeleton while sliding away;
// only the incoming screen mounts fresh.
//
// The day sheet is a self-contained bottom sheet (same animation as NumpadModal)
// — it does NOT touch useUIStore.activeModal, since the floating tab bar is
// already covered by this pushed route.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useBubbleColors, useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { computeMonthDelta } from '@/lib/forecast';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { BLUR, RADII, SPRING } from '@/constants/theme';
import { MONTHS, MONTHS_SHORT, WEEKDAYS_SHORT } from '@/lib/i18n';
import type {
  BubbleColorKey,
  CategoryTotal,
  MonthlyTotal,
  TransactionWithCategory,
  WeeklyTotal,
} from '@/types';
import {
  useDayTransactions,
  useMonthDetail,
  useMonthlyTotals,
  useWeekDetail,
  weekDayRange,
} from './useInsightData';

// Semantic colors — defined locally as the rest of the app does (TotalDisplay,
// HistoryScreen, NumpadModal all keep INCOME/DEFICIT as file-level constants).
const INCOME_COLOR = '#3DB882';
const DEFICIT_COLOR = '#F76C6C';
// The app accent (#7C6AF7) at 50% — used for the current-month ring. The theme
// doesn't expose an accent-with-alpha token, so this mirrors glass.glow's style.
const ACCENT_RING = 'rgba(124,106,247,0.5)';

// Level-stack slide — flat timing (no spring bounce, no parallax). Only the
// frame on top moves; the other sits still beneath it.
const SLIDE_DURATION_IN = 280;
const SLIDE_DURATION_OUT = 240;

// Year-bubble sizing (mirrors the home bubble formula, smaller range).
const BUBBLE_BASE = 52;
const BUBBLE_MAX = 82;
const BUBBLE_EMPTY = 42;
const BUBBLE_SLOT = BUBBLE_MAX + 30; // grid cell height — centers each bubble

// Cycle the 8 bubble hues across the 12 month bubbles, echoing the home field.
const BUBBLE_KEYS: BubbleColorKey[] = [
  'frost',
  'mist',
  'dusk',
  'slate',
  'ash',
  'haze',
  'veil',
  'smoke',
];

// Full weekday names, index = weekday (0=Sun … 6=Sat) — for the day-sheet header.
const DAY_NAMES_FULL: Record<'en' | 'vi', string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  vi: ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'],
};

type InsightLevel =
  | { type: 'year' }
  | { type: 'month'; mi: number } // mi = 1-12
  | { type: 'week'; mi: number; wi: number }; // wi = 0-3

type DaySelection = { mi: number; day: number; weekday: number };

type Frame = { key: number; level: InsightLevel };

const pad2 = (n: number) => String(n).padStart(2, '0');

export function InsightScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const [year, setYear] = useState(currentYear);
  const [stack, setStack] = useState<InsightLevel[]>([{ type: 'year' }]);
  const [frames, setFrames] = useState<Frame[]>([{ key: 0, level: { type: 'year' } }]);
  const [transition, setTransition] = useState<{
    movingKey: number;
    direction: 'push' | 'pop';
  } | null>(null);
  const [daySel, setDaySel] = useState<DaySelection | null>(null);

  const keyRef = useRef(0);
  const slideX = useSharedValue(0);

  const finishTransition = useCallback((keepKey: number) => {
    setFrames((f) => f.filter((fr) => fr.key === keepKey));
    setTransition(null);
  }, []);

  const push = useCallback(
    (next: InsightLevel) => {
      if (transition) return; // ignore taps mid-slide
      const current = frames[frames.length - 1];
      const newKey = (keyRef.current += 1);
      const incoming: Frame = { key: newKey, level: next };
      Haptics.selectionAsync();
      setStack((s) => [...s, next]);
      setFrames([current, incoming]);
      // Incoming slides over the (stationary) outgoing — flat, no bounce.
      setTransition({ movingKey: newKey, direction: 'push' });
      slideX.value = screenWidth;
      slideX.value = withTiming(
        0,
        { duration: SLIDE_DURATION_IN, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishTransition)(newKey);
        },
      );
    },
    [transition, frames, screenWidth, slideX, finishTransition],
  );

  const pop = useCallback(() => {
    if (transition) return;
    if (stack.length <= 1) {
      router.back();
      return;
    }
    const current = frames[frames.length - 1];
    const prevLevel = stack[stack.length - 2];
    const newKey = (keyRef.current += 1);
    const incoming: Frame = { key: newKey, level: prevLevel };
    Haptics.selectionAsync();
    setStack((s) => s.slice(0, -1));
    setFrames([incoming, current]);
    // Outgoing slides off to the right, revealing the (stationary) incoming.
    setTransition({ movingKey: current.key, direction: 'pop' });
    slideX.value = 0;
    slideX.value = withTiming(
      screenWidth,
      { duration: SLIDE_DURATION_OUT, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishTransition)(newKey);
      },
    );
  }, [transition, stack, frames, screenWidth, slideX, finishTransition]);

  const openDay = useCallback((sel: DaySelection) => {
    Haptics.selectionAsync();
    setDaySel(sel);
  }, []);
  const closeDay = useCallback(() => setDaySel(null), []);

  // Android hardware back: close the day sheet, then pop a level, then let the
  // route pop back to History.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (daySel) {
        closeDay();
        return true;
      }
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [daySel, stack.length, pop, closeDay]);

  const movingStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  const renderLevel = (level: InsightLevel): ReactNode => {
    switch (level.type) {
      case 'year':
        return (
          <YearLevel
            year={year}
            currentYear={currentYear}
            currentMonth={currentMonth}
            onPrevYear={() => setYear((y) => y - 1)}
            onNextYear={() => setYear((y) => Math.min(currentYear, y + 1))}
            onClose={() => router.back()}
            onSelectMonth={(mi) => push({ type: 'month', mi })}
          />
        );
      case 'month':
        return (
          <MonthLevel
            year={year}
            mi={level.mi}
            onBack={pop}
            onSelectWeek={(wi) => push({ type: 'week', mi: level.mi, wi })}
          />
        );
      case 'week':
        return (
          <WeekLevel
            year={year}
            mi={level.mi}
            wi={level.wi}
            onBack={pop}
            onSelectDay={(day, weekday) => openDay({ mi: level.mi, day, weekday })}
          />
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top }]}>
      <View style={styles.levelHost}>
        {frames.map((frame) => {
          // Only the "moving" frame animates; the other stays flat at 0 beneath it.
          const isMoving = transition?.movingKey === frame.key;
          return (
            <Animated.View
              key={frame.key}
              style={[StyleSheet.absoluteFill, isMoving && movingStyle, { zIndex: isMoving ? 2 : 1 }]}
            >
              {renderLevel(frame.level)}
            </Animated.View>
          );
        })}
      </View>

      <DaySheet year={year} selection={daySel} onClose={closeDay} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Year level — 12 floating month bubbles + a year stats row
// ---------------------------------------------------------------------------

interface YearLevelProps {
  year: number;
  currentYear: number;
  currentMonth: number;
  onPrevYear: () => void;
  onNextYear: () => void;
  onClose: () => void;
  onSelectMonth: (mi: number) => void;
}

function YearLevel({
  year,
  currentYear,
  currentMonth,
  onPrevYear,
  onNextYear,
  onClose,
  onSelectMonth,
}: YearLevelProps) {
  const colors = useColors();
  const { t, language } = useTranslation();
  const { compact } = useFormatCurrency();
  const monthly = useMonthlyTotals(year);

  const canGoNext = year < currentYear;

  const totals = monthly
    ? monthly.reduce(
        (acc, m) => ({ expense: acc.expense + m.expense, income: acc.income + m.income }),
        { expense: 0, income: 0 },
      )
    : { expense: 0, income: 0 };
  const net = totals.income - totals.expense;
  const maxExpense = monthly ? Math.max(0, ...monthly.map((m) => m.expense)) : 0;

  // Map sparse rows → a 12-slot lookup by month.
  const byMonth = new Map<number, MonthlyTotal>();
  if (monthly) for (const m of monthly) byMonth.set(m.month, m);

  return (
    <View style={styles.level}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
          <Feather name="chevron-left" size={24} color={colors.text.secondary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('insight.title')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.yearNav}>
        <Pressable onPress={onPrevYear} hitSlop={12} style={styles.yearArrow}>
          <Feather name="chevron-left" size={20} color={colors.text.secondary} />
        </Pressable>
        <Text style={[styles.yearLabel, { color: colors.text.primary }]}>{year}</Text>
        <Pressable
          onPress={canGoNext ? onNextYear : undefined}
          disabled={!canGoNext}
          hitSlop={12}
          style={styles.yearArrow}
        >
          <Feather
            name="chevron-right"
            size={20}
            color={canGoNext ? colors.text.secondary : colors.text.tertiary}
          />
        </Pressable>
      </View>

      <StatRow expense={totals.expense} income={totals.income} net={net} />

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {monthly === null ? (
          <YearSkeleton />
        ) : (
          <View style={styles.grid}>
            {Array.from({ length: 12 }, (_, i) => {
              const mi = i + 1;
              const data = byMonth.get(mi);
              const expense = data?.expense ?? 0;
              const isFuture = year === currentYear && mi > currentMonth;
              const isCurrent = year === currentYear && mi === currentMonth;
              const hasData = expense > 0;
              const size = hasData
                ? BUBBLE_BASE + (expense / maxExpense) * (BUBBLE_MAX - BUBBLE_BASE)
                : BUBBLE_EMPTY;
              return (
                <MonthBubble
                  key={mi}
                  idx={i}
                  label={MONTHS_SHORT[language][i]}
                  amount={hasData ? compact(expense) : null}
                  size={size}
                  colorKey={BUBBLE_KEYS[i % BUBBLE_KEYS.length]}
                  isCurrent={isCurrent}
                  isFuture={isFuture}
                  onPress={() => onSelectMonth(mi)}
                />
              );
            })}
          </View>
        )}
        <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('insight.tapDetail')}</Text>
      </ScrollView>
    </View>
  );
}

interface MonthBubbleProps {
  idx: number;
  label: string;
  amount: string | null;
  size: number;
  colorKey: BubbleColorKey;
  isCurrent: boolean;
  isFuture: boolean;
  onPress: () => void;
}

function MonthBubble({
  idx,
  label,
  amount,
  size,
  colorKey,
  isCurrent,
  isFuture,
  onPress,
}: MonthBubbleProps) {
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const swatch = bubbleColors[colorKey];

  const floatY = useSharedValue(0);
  const entry = useSharedValue(0);

  const floatDuration = 2800 + ((idx * 30) % 800);
  const floatAmplitude = 4 + ((idx * 0.03) % 3);

  useEffect(() => {
    entry.value = withDelay(idx * 40, withTiming(1, { duration: 280 }));
    floatY.value = withDelay(
      idx * 150,
      withRepeat(
        withSequence(
          withTiming(-floatAmplitude, { duration: floatDuration / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(floatAmplitude, { duration: floatDuration / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(floatY);
      cancelAnimation(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: entry.value * (isFuture ? 0.4 : 1),
    transform: [{ translateY: floatY.value }, { scale: 0.85 + entry.value * 0.15 }],
  }));

  const ringSize = size + 10;

  return (
    <Pressable
      style={styles.cell}
      onPress={isFuture ? undefined : onPress}
      disabled={isFuture}
      hitSlop={4}
    >
      <Animated.View style={[styles.bubbleWrap, animStyle]}>
        {isCurrent ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.bubble,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: swatch.glassFill,
              borderColor: swatch.border,
            },
          ]}
        >
          <View style={[styles.bubbleBloom, { height: size * 0.42 }]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', swatch.tintColor]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <Text style={[styles.bubbleLabel, { color: colors.text.secondary }]}>{label}</Text>
          {amount ? (
            <Text style={[styles.bubbleAmount, { color: colors.text.primary }]} numberOfLines={1}>
              {amount}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Month level — stats + category breakdown + 4 tappable week columns
// ---------------------------------------------------------------------------

interface MonthLevelProps {
  year: number;
  mi: number;
  onBack: () => void;
  onSelectWeek: (wi: number) => void;
}

function MonthLevel({ year, mi, onBack, onSelectWeek }: MonthLevelProps) {
  const colors = useColors();
  const { t, language } = useTranslation();
  const detail = useMonthDetail(year, mi);

  const title = `${MONTHS[language][mi - 1].toUpperCase()} · ${year}`;

  const totals = detail
    ? detail.weekly.reduce(
        (acc, w) => ({ expense: acc.expense + w.expense, income: acc.income + w.income }),
        { expense: 0, income: 0 },
      )
    : { expense: 0, income: 0 };
  const net = totals.income - totals.expense;

  // Month-over-month change in expense vs the previous month. Only shown once
  // there's a baseline (prevExpense > 0 → ratio is non-null). For spending, more
  // is the deficit color and less is the income color.
  const delta = detail ? computeMonthDelta(totals.expense, detail.prevExpense) : null;
  const prevLabel = MONTHS_SHORT[language][(mi === 1 ? 12 : mi - 1) - 1];
  const momColor =
    delta?.direction === 'up'
      ? DEFICIT_COLOR
      : delta?.direction === 'down'
        ? INCOME_COLOR
        : colors.text.tertiary;

  return (
    <View style={styles.level}>
      <LevelHeader title={title} onBack={onBack} />
      <StatRow expense={totals.expense} income={totals.income} net={net} />

      {delta && delta.ratio !== null ? (
        <View style={styles.momRow}>
          <Feather
            name={delta.direction === 'up' ? 'arrow-up-right' : 'arrow-down-right'}
            size={13}
            color={momColor}
          />
          <Text style={[styles.momPct, { color: momColor }]}>
            {Math.abs(Math.round(delta.ratio * 100))}%
          </Text>
          <Text style={[styles.momVs, { color: colors.text.tertiary }]}>
            {t('insight.vsPrev')} {prevLabel}
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {detail === null ? (
          <DetailSkeleton />
        ) : (
          <>
            <SectionTitle title={t('insight.spendingBreakdown')} />
            <BreakdownBars categories={detail.categories} />

            <SectionTitle title={t('insight.byWeek')} hint={t('insight.tapDetail')} />
            <WeekBars
              weekly={detail.weekly}
              language={language}
              onSelectWeek={onSelectWeek}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface WeekBarsProps {
  weekly: WeeklyTotal[];
  language: 'en' | 'vi';
  onSelectWeek: (wi: number) => void;
}

function WeekBars({ weekly, language, onSelectWeek }: WeekBarsProps) {
  const colors = useColors();
  const { compact } = useFormatCurrency();

  const slots = [0, 1, 2, 3].map((i) => weekly.find((w) => w.weekIdx === i)?.expense ?? 0);
  const max = Math.max(1, ...slots);

  return (
    <View style={styles.barRow}>
      {slots.map((expense, i) => {
        const barHeight = expense > 0 ? Math.max(6, (expense / max) * 120) : 0;
        return (
          <Pressable key={i} style={styles.barCol} onPress={() => onSelectWeek(i)} hitSlop={4}>
            <Text style={[styles.barValue, { color: colors.text.secondary }]} numberOfLines={1}>
              {compact(expense) ?? ''}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: colors.glass.base }]}>
              <View
                style={[styles.bar, { height: barHeight, backgroundColor: colors.accent }]}
              />
            </View>
            <Text style={[styles.barLabel, { color: colors.text.tertiary }]}>
              {language === 'vi' ? 'T' : 'W'}
              {i + 1}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Week level — stats (total/peak/avg) + 7-day chart + category breakdown
// ---------------------------------------------------------------------------

interface WeekLevelProps {
  year: number;
  mi: number;
  wi: number;
  onBack: () => void;
  onSelectDay: (day: number, weekday: number) => void;
}

type DaySlot = { day: number; weekday: number; expense: number } | null;

function WeekLevel({ year, mi, wi, onBack, onSelectDay }: WeekLevelProps) {
  const colors = useColors();
  const { t, language } = useTranslation();
  const { compact } = useFormatCurrency();
  const detail = useWeekDetail(year, mi, wi);

  const title = `${t('insight.week')} ${wi + 1} · ${MONTHS_SHORT[language][mi - 1]} · ${year}`;

  // Map daily rows onto 7 Monday-first slots. Weeks 0–2 hold exactly one day per
  // weekday; the week-3 tail can collide, so we sum the height and keep the
  // bigger day as the tap target (this view is a pattern overview, not a ledger).
  const slots: DaySlot[] = Array.from({ length: 7 }, () => null);
  if (detail) {
    for (const d of detail.daily) {
      const idx = (d.weekday + 6) % 7;
      const cur = slots[idx];
      if (!cur) {
        slots[idx] = { day: d.day, weekday: d.weekday, expense: d.expense };
      } else {
        const keep = d.expense >= cur.expense ? d : cur;
        slots[idx] = { day: keep.day, weekday: keep.weekday, expense: cur.expense + d.expense };
      }
    }
  }

  const total = detail ? detail.daily.reduce((s, d) => s + d.expense, 0) : 0;
  const peak = detail ? Math.max(0, ...detail.daily.map((d) => d.expense)) : 0;
  const { startDay, endDay } = weekDayRange(wi);
  const daysInMonth = new Date(year, mi, 0).getDate();
  const daysInRange = Math.min(endDay, daysInMonth) - startDay + 1;
  const dailyAvg = daysInRange > 0 ? total / daysInRange : 0;

  return (
    <View style={styles.level}>
      <LevelHeader title={title} onBack={onBack} />
      <StatRow
        items={[
          { label: t('spent'), value: compact(total) ?? '0', color: colors.text.primary },
          { label: t('insight.peakDay'), value: compact(peak) ?? '0', color: colors.text.primary },
          { label: t('insight.dailyAvg'), value: compact(dailyAvg) ?? '0', color: colors.text.primary },
        ]}
      />

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {detail === null ? (
          <DetailSkeleton />
        ) : (
          <>
            <SectionTitle title={t('insight.byDay')} hint={t('insight.tapTransactions')} />
            <DayBars slots={slots} language={language} onSelectDay={onSelectDay} />

            <SectionTitle title={t('insight.spendingBreakdown')} />
            <BreakdownBars categories={detail.categories} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface DayBarsProps {
  slots: DaySlot[];
  language: 'en' | 'vi';
  onSelectDay: (day: number, weekday: number) => void;
}

function DayBars({ slots, language, onSelectDay }: DayBarsProps) {
  const colors = useColors();
  const labels = WEEKDAYS_SHORT[language];
  const max = Math.max(1, ...slots.map((s) => s?.expense ?? 0));

  return (
    <View style={styles.barRow}>
      {slots.map((slot, i) => {
        const expense = slot?.expense ?? 0;
        const barHeight = expense > 0 ? Math.max(5, (expense / max) * 110) : 0;
        const isPeak = expense > 0 && expense === max;
        return (
          <Pressable
            key={i}
            style={styles.dayCol}
            onPress={slot ? () => onSelectDay(slot.day, slot.weekday) : undefined}
            disabled={!slot}
            hitSlop={4}
          >
            <View style={[styles.barTrack, { backgroundColor: colors.glass.base }]}>
              <View
                style={[
                  styles.bar,
                  { height: barHeight, backgroundColor: isPeak ? colors.accent : colors.glass.borderStrong },
                ]}
              />
            </View>
            <Text style={[styles.barLabel, { color: colors.text.tertiary }]}>{labels[i]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Day sheet — bottom sheet with the selected day's transactions
// ---------------------------------------------------------------------------

interface DaySheetProps {
  year: number;
  selection: DaySelection | null;
  onClose: () => void;
}

function DaySheet({ year, selection, onClose }: DaySheetProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t, language } = useTranslation();
  const { format, compact } = useFormatCurrency();
  const { height: windowHeight } = useWindowDimensions();

  // Keep the last opened selection so content persists through the close slide.
  const [shown, setShown] = useState<DaySelection | null>(null);
  useEffect(() => {
    if (selection) setShown(selection);
  }, [selection]);

  const rows = useDayTransactions(year, selection ? { month: selection.mi, day: selection.day } : null);

  const isOpen = selection !== null;
  const hiddenOffset = useSharedValue(windowHeight);
  const sheetOffset = useSharedValue(windowHeight);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      hiddenOffset.value = e.nativeEvent.layout.height;
    },
    [hiddenOffset],
  );

  useEffect(() => {
    if (isOpen) {
      sheetOffset.value = withSpring(0, SPRING.sheet);
    } else {
      sheetOffset.value = withSpring(hiddenOffset.value, SPRING.sheet);
    }
  }, [isOpen, sheetOffset, hiddenOffset]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOpen ? 1 : 0, { duration: 220 }),
    pointerEvents: isOpen ? ('auto' as const) : ('none' as const),
  }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetOffset.value }] }));

  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(17,17,28,0.72)';

  const dayTotal = rows ? rows.reduce((s, r) => s + (r.type === 'expense' ? r.amount : 0), 0) : 0;
  // Use the live selection when open; fall back to the last shown one while the
  // sheet slides closed so the header doesn't blank out mid-animation.
  const display = selection ?? shown;
  const dateLabel = display
    ? `${DAY_NAMES_FULL[language][display.weekday]}, ${pad2(display.day)}/${pad2(display.mi)}`
    : '';

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View onLayout={handleLayout} style={[styles.sheetWrapper, sheetStyle]}>
        <GlassSurface
          intensity={BLUR.sheet}
          borderRadius={RADII.sheet}
          surfaceTint={sheetTint}
          shimmer
          style={styles.sheetGlass}
        >
          <View style={styles.sheetBody}>
            <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />

            <Text style={[styles.sheetDate, { color: colors.text.secondary }]}>{dateLabel}</Text>
            <Text style={[styles.sheetTotal, { color: colors.text.primary }]}>
              {compact(dayTotal) ?? '0'}
            </Text>

            <ScrollView
              style={{ maxHeight: windowHeight * 0.5 }}
              contentContainerStyle={styles.sheetList}
              showsVerticalScrollIndicator={false}
            >
              {rows && rows.length > 0 ? (
                rows.map((tx) => <DayRow key={tx.id} tx={tx} format={format} />)
              ) : (
                <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
                  {t('insight.noTransactions')}
                </Text>
              )}
            </ScrollView>
          </View>
        </GlassSurface>
      </Animated.View>
    </>
  );
}

interface DayRowProps {
  tx: TransactionWithCategory;
  format: (amount: number) => string;
}

function DayRow({ tx, format }: DayRowProps) {
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const isIncome = tx.type === 'income';
  const swatch = bubbleColors[tx.colorKey];
  const time = new Date(tx.transactedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.dayRow}>
      <View
        style={[styles.dayRowIcon, { backgroundColor: swatch.bg, borderColor: swatch.border }]}
      >
        <Text style={styles.dayRowEmoji}>{tx.emoji}</Text>
      </View>
      <View style={styles.dayRowInfo}>
        <Text style={[styles.dayRowName, { color: colors.text.primary }]} numberOfLines={1}>
          {tx.categoryName}
        </Text>
        <Text style={[styles.dayRowTime, { color: colors.text.tertiary }]} numberOfLines={1}>
          {tx.note ? `${time}  ·  ${tx.note}` : time}
        </Text>
      </View>
      <Text
        style={[styles.dayRowAmount, { color: isIncome ? INCOME_COLOR : colors.text.primary }]}
      >
        {isIncome ? '+' : '−'}
        {format(tx.amount)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

interface LevelHeaderProps {
  title: string;
  onBack: () => void;
}

function LevelHeader({ title, onBack }: LevelHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.headerBtn}>
        <Feather name="chevron-left" size={24} color={colors.text.secondary} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

type StatItem = { label: string; value: string; color: string };

interface StatRowProps {
  // Either pass an expense/income/net trio, or explicit items (week level).
  expense?: number;
  income?: number;
  net?: number;
  items?: StatItem[];
}

function StatRow({ expense, income, net, items }: StatRowProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { compact } = useFormatCurrency();

  const resolved: StatItem[] =
    items ??
    [
      { label: t('spent'), value: `↓ ${compact(expense ?? 0) ?? '0'}`, color: colors.text.primary },
      { label: t('earned'), value: `↑ ${compact(income ?? 0) ?? '0'}`, color: INCOME_COLOR },
      {
        label: t('net'),
        value: `${(net ?? 0) >= 0 ? '+' : '−'} ${compact(Math.abs(net ?? 0)) ?? '0'}`,
        color: (net ?? 0) >= 0 ? INCOME_COLOR : DEFICIT_COLOR,
      },
    ];

  return (
    <View style={styles.statRow}>
      {resolved.map((item) => (
        <View key={item.label} style={styles.statCol}>
          <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
            {item.label.toUpperCase()}
          </Text>
          <Text style={[styles.statValue, { color: item.color }]} numberOfLines={1}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.text.tertiary }]}>{title.toUpperCase()}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.text.tertiary }]}>{hint}</Text> : null}
    </View>
  );
}

function BreakdownBars({ categories }: { categories: CategoryTotal[] }) {
  const colors = useColors();
  const bubbleColors = useBubbleColors();
  const { format } = useFormatCurrency();
  const { t } = useTranslation();

  if (categories.length === 0) {
    return <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>{t('insight.noData')}</Text>;
  }

  const total = categories.reduce((s, c) => s + c.expense, 0);
  const max = categories[0].expense;

  return (
    <View style={styles.breakdown}>
      {categories.map((c) => {
        const swatch = bubbleColors[c.colorKey];
        const barWidth = max > 0 ? Math.max(0.04, c.expense / max) : 0;
        const percent = total > 0 ? Math.round((c.expense / total) * 100) : 0;
        return (
          <View key={c.categoryId} style={styles.breakdownRow}>
            <View style={styles.breakdownLabelRow}>
              <Text style={styles.breakdownEmoji}>{c.emoji}</Text>
              <Text style={[styles.breakdownName, { color: colors.text.secondary }]} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={[styles.breakdownAmount, { color: colors.text.primary }]}>
                {format(c.expense)}
              </Text>
              <Text style={[styles.breakdownPercent, { color: colors.text.tertiary }]}>{percent}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.glass.base }]}>
              <View
                style={[styles.trackFill, { width: `${barWidth * 100}%`, backgroundColor: swatch.border }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// --- Skeletons (opacity pulse while a level's SQLite read resolves) ---

function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  style?: object;
}) {
  const colors = useColors();
  const op = useSharedValue(0.4);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 600 }), withTiming(0.4, { duration: 600 })),
      -1,
      true,
    );
    return () => cancelAnimation(op);
  }, [op]);
  const aStyle = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.glass.base }, aStyle, style]}
    />
  );
}

function YearSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={styles.cell}>
          <SkeletonBlock width={64} height={64} radius={32} />
        </View>
      ))}
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={{ paddingTop: 8 }}>
      <SkeletonBlock width="40%" height={12} style={{ marginBottom: 16 }} />
      <SkeletonBlock width="100%" height={14} style={{ marginBottom: 10 }} />
      <SkeletonBlock width="80%" height={14} style={{ marginBottom: 10 }} />
      <SkeletonBlock width="60%" height={14} style={{ marginBottom: 24 }} />
      <SkeletonBlock width="100%" height={140} radius={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  levelHost: {
    flex: 1,
  },
  level: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Year nav
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 4,
  },
  yearArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearLabel: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.5,
    minWidth: 72,
    textAlign: 'center',
  },
  // Stats
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 1.3,
    marginBottom: 4,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
  // Month-over-month delta pill under the stat row
  momRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: -4,
    marginBottom: 4,
  },
  momPct: {
    fontSize: 13,
    fontWeight: '700',
  },
  momVs: {
    fontSize: 12,
    marginLeft: 2,
  },
  // Year grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '33.333%',
    height: BUBBLE_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: ACCENT_RING,
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  bubbleBloom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  bubbleAmount: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.3,
    marginTop: 8,
  },
  // Sections
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  // Bars (week columns / day columns)
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  barTrack: {
    width: '70%',
    height: 120,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  // Breakdown
  breakdown: {
    marginTop: 2,
  },
  breakdownRow: {
    marginBottom: 12,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownEmoji: {
    fontSize: 14,
    marginRight: 7,
  },
  breakdownName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  breakdownPercent: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    minWidth: 34,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  // Day sheet
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 10,
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 11,
  },
  sheetGlass: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetDate: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sheetTotal: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  sheetList: {
    paddingBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  dayRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRowEmoji: {
    fontSize: 18,
  },
  dayRowInfo: {
    flex: 1,
  },
  dayRowName: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayRowTime: {
    fontSize: 12,
    marginTop: 2,
  },
  dayRowAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
});
