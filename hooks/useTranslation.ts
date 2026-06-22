// Reactive translation hook tied to settings

import { useCallback } from 'react';
import { TRANSLATIONS } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useTranslation() {
  const language = useSettingsStore((s) => s.language);

  const t = useCallback(
    (key: TranslationKey): string =>
      TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key,
    [language],
  );

  return { t, language };
}
