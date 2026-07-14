import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ConsentScope } from '@earlysteps/shared-types';
import { CONSENT_COPY } from '@earlysteps/content';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';
import { PersonalizedText } from '../PersonalizedText/PersonalizedText.js';

export interface ConsentToggleProps {
  scope: ConsentScope;
  value: boolean;
  onChange: (next: boolean) => void;
  /**
   * Child's nickname for `[child]` placeholders in the consent copy (#36). Optional
   * because the Consent Center is first visited during onboarding, before a child
   * profile exists — the copy then reads "your child" instead.
   */
  childName?: string;
  /**
   * Issue #123: some scopes are tier-gated (e.g. `media_capture` on a free account) — the
   * toggle stays visible and legible but can't be switched on, with a short reason shown
   * instead of silently disappearing (the caregiver should never wonder where an option went).
   */
  disabled?: boolean;
  /** Reason shown under the label while `disabled`, e.g. "Available on Premium". */
  disabledReason?: string;
}

/** Decorative per-scope icon so each consent card is recognisable at a glance. */
const SCOPE_ICON: Record<ConsentScope, keyof typeof Ionicons.glyphMap> = {
  data_storage: 'lock-closed-outline',
  ai_analysis: 'sparkles-outline',
  media_capture: 'camera-outline',
  professional_sharing: 'share-social-outline',
};

/**
 * One layer of consent (CLAUDE.md §6, product plan §4.7). Each scope is toggled
 * independently — the Consent Center renders one `<ConsentToggle scope=... />` per scope,
 * never a single bundled "I agree." Controlled component: the caller (onboarding flow) owns
 * consent state so it can be persisted, revoked, and audited. Label + explanation come from
 * @earlysteps/content, not hardcoded, so a consent-copy change routes through clinical review
 * like any other result/report copy.
 */
export function ConsentToggle({
  scope,
  value,
  onChange,
  childName,
  disabled = false,
  disabledReason,
}: ConsentToggleProps) {
  const copy = CONSENT_COPY.scopes[scope];

  return (
    <View style={[styles.card, disabled && styles.cardDisabled]}>
      <View
        style={styles.iconCircle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name={SCOPE_ICON[scope]} size={20} color={colors.primary} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.label}>{copy.label}</Text>
        <PersonalizedText
          template={copy.explanation}
          name={childName ?? 'your child'}
          style={styles.explanation}
        />
        {disabled && disabledReason && (
          <Text style={styles.disabledReason}>{disabledReason}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={copy.label}
        accessibilityRole="switch"
        accessibilityState={{ disabled }}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...cardShadow,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textColumn: {
    flex: 1,
    marginRight: spacing.md,
  },
  label: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  explanation: {
    marginTop: 2,
    ...type.caption,
    color: colors.inkSoft,
  },
  disabledReason: {
    marginTop: spacing.xs,
    ...type.caption,
    color: colors.accent,
    fontWeight: '600',
  },
});
