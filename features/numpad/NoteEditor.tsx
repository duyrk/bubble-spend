// Centered overlay for adding/editing a transaction note (edit flow). Uses a
// real TextInput, so it wraps in KeyboardAvoidingView to stay above the system
// keyboard rather than fighting the bottom-anchored numpad sheet.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useColors, useResolvedTheme } from '@/hooks/useTheme';
import { BLUR, RADII } from '@/constants/theme';

interface NoteEditorProps {
  initialValue: string;
  placeholder: string;
  saveLabel: string;
  accentColor: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export function NoteEditor({
  initialValue,
  placeholder,
  saveLabel,
  accentColor,
  onSave,
  onClose,
}: NoteEditorProps) {
  const colors = useColors();
  const resolvedTheme = useResolvedTheme();
  const [value, setValue] = useState(initialValue);
  const sheetTint =
    resolvedTheme === 'light' ? 'rgba(255,255,255,0.72)' : 'rgba(17,17,28,0.72)';
  const inputBg =
    resolvedTheme === 'light' ? 'rgba(13,13,20,0.04)' : 'rgba(255,255,255,0.06)';

  return (
    <View style={styles.overlay}>
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.avoider}
      >
        <GlassSurface
          intensity={BLUR.sheet}
          borderRadius={RADII.sheet}
          surfaceTint={sheetTint}
          shimmer
          style={styles.card}
        >
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.text.tertiary}
            style={[
              styles.input,
              { backgroundColor: inputBg, color: colors.text.primary, borderColor: colors.glass.border },
            ]}
            autoFocus
            multiline
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => onSave(value)}
          />
          <Pressable
            onPress={() => onSave(value)}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.saveText}>{saveLabel}</Text>
          </Pressable>
        </GlassSurface>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  avoider: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'stretch',
  },
  card: {
    padding: 16,
  },
  input: {
    minHeight: 80,
    borderRadius: RADII.input,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  saveBtn: {
    borderRadius: RADII.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
