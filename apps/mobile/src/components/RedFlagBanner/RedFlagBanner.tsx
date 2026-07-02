import { StyleSheet, Text, View } from 'react-native';
import { URGENT_RED_FLAG_TYPES, type RedFlagType } from '@earlysteps/shared-types';
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
 * Urgent types (self_injury_risk, safety_risk) additionally surface a calm resource block —
 * still no diagnostic language, no shaming.
 */
export function RedFlagBanner({ redFlagTypes }: RedFlagBannerProps) {
  if (redFlagTypes.length === 0) return null;

  const isUrgent = redFlagTypes.some((t) =>
    (URGENT_RED_FLAG_TYPES as readonly RedFlagType[]).includes(t),
  );

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{RED_FLAG_COPY.base_message}</Text>
      {/* The next-steps heading only renders when there is content under it (currently the
          urgent resource block) — a bare "what to do next" promising nothing is worse than
          letting the base message's own guidance stand alone. */}
      {isUrgent && (
        <>
          <Text style={styles.heading}>{RED_FLAG_COPY.next_steps_heading}</Text>
          <View style={styles.urgentBlock}>
            <Text style={styles.urgentHeading}>
              {RED_FLAG_COPY.urgent_resource_heading}
            </Text>
            <Text style={styles.urgentMessage}>
              {RED_FLAG_COPY.urgent_resource_message}
            </Text>
          </View>
        </>
      )}
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
  heading: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#1F3A38',
  },
  urgentBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#BFDAD7',
  },
  urgentHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F3A38',
  },
  urgentMessage: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: '#1F3A38',
  },
});
