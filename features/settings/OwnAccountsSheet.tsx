// "My accounts" editor — the user's own account numbers / holder names, one per
// line. A captured transfer mentioning any of them is treated as moving money
// between their own pockets (MoMo ↔ ACB), never as spending or income.

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { RADII } from '@/constants/theme';

interface OwnAccountsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function OwnAccountsSheet({ visible, onClose }: OwnAccountsSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const { t } = useTranslation();
  const ownAccounts = useSettingsStore((s) => s.ownAccounts);
  const setOwnAccounts = useSettingsStore((s) => s.setOwnAccounts);
  const [draft, setDraft] = useState('');

  // Re-seed the draft from the saved list each time the sheet opens.
  useEffect(() => {
    if (visible) setDraft(ownAccounts.join('\n'));
  }, [visible, ownAccounts]);

  const handleSave = () => {
    const accounts = draft
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 4);
    setOwnAccounts([...new Set(accounts)]);
    onClose();
  };

  const inputBg = resolvedTheme === 'light' ? 'rgba(13,13,20,0.04)' : 'rgba(255,255,255,0.06)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.glass.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.glass.borderStrong }]} />
          <Text style={[styles.title, { color: colors.text.primary }]}>{t('myAccounts')}</Text>
          <Text style={[styles.hint, { color: colors.text.secondary }]}>{t('myAccountsHint')}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="VO KHANH DUY"
            placeholderTextColor={colors.text.tertiary}
            style={[styles.input, { color: colors.text.primary, backgroundColor: inputBg }]}
          />
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.accent }, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.saveText}>{t('save')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    borderWidth: 1,
    gap: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    minHeight: 110,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: RADII.pill,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  saveText: {
    color: '#fff', // same white-on-accent as HomeScreen's Done button
    fontSize: 15,
    fontWeight: '700',
  },
});
