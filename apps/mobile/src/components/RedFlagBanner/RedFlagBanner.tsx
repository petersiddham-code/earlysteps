import { StyleSheet, Text, View } from 'react-native';
import type { RedFlagType } from '@earlysteps/shared-types';
import { RED_FLAG_COPY } from '@earlysteps/content';

export interface RedFlagBannerProps {
  redFlagTypes: RedFlagType[];
}

/**
 * Calm, non-alarmist red-flag escalation banner (CLAUDE.md §6, product plan §4.8). This is
 * deliberately NOT styled like an error/alert state — soft teal, not harsh red, no warning
 * iconography — per the product plan's explicit tone guidance. Copy comes from
 * @earlysteps/content (clinical content, gated by docs/clinical-review/), never hardcoded
 * here. Renders nothing if there are no red flags.
 *
 * This banner carries the GENERAL escalation message for every red flag. Urgent types
 * (self_injury_risk, safety_risk) additionally surface the one-tap crisis block — that's
 * <CrisisSupportCard />, rendered separately at the top of the results screen (issue #50),
 * so urgent and non-urgent flags are visually distinct.
 */
export function RedFlagBanner({ redFlagTypes }: RedFlagBannerProps) {
  if (redFlagTypes.length === 0) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{RED_FLAG_COPY.base_message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Calm teal, not error-red — this is guidance, not a failure state.
  banner: {
    backgroundColor: '#E3F2F1',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#3D8B85',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1F3A38',
  },
});
