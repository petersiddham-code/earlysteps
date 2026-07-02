import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, type } from '../../theme/index.js';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label and blocks presses. */
  loading?: boolean;
  /** 'primary' = filled teal; 'quiet' = borderless text button for secondary actions. */
  variant?: 'primary' | 'quiet';
  testID?: string;
}

/** The one button style used across all screens (replaces per-screen Pressables and RN's Button). */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  testID,
}: PrimaryButtonProps) {
  const quiet = variant === 'quiet';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        quiet ? styles.quiet : styles.primary,
        !quiet && disabled && styles.primaryDisabled,
        pressed && !quiet && styles.primaryPressed,
        pressed && quiet && styles.quietPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={quiet ? colors.primary : colors.card} />
      ) : (
        <Text style={[styles.label, quiet ? styles.quietLabel : styles.primaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryDeep,
  },
  primaryDisabled: {
    backgroundColor: colors.disabled,
  },
  quiet: {
    backgroundColor: 'transparent',
  },
  quietPressed: {
    opacity: 0.6,
  },
  label: {
    ...type.bodyStrong,
    fontSize: 16,
  },
  primaryLabel: {
    color: colors.card,
  },
  quietLabel: {
    color: colors.primary,
  },
});
