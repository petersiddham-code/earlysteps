import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { URGENT_RED_FLAG_TYPES, type RedFlagType } from '@earlysteps/shared-types';
import { RED_FLAG_COPY, type UrgentResource } from '@earlysteps/content';
import { colors, radius, spacing, type } from '../../theme/index.js';

export interface CrisisSupportCardProps {
  redFlagTypes: RedFlagType[];
}

/** tel: values are dialable one-tap only without separators; URLs pass through untouched. */
export function resourceHref(resource: UrgentResource): string {
  return resource.kind === 'tel'
    ? `tel:${resource.value.replace(/[\s-]/g, '')}`
    : resource.value;
}

/**
 * One-tap crisis-resource block (issue #50, product plan §10 rule 10): rendered wherever a
 * self-injury or safety red flag is shown, immediately and visually distinct from both the
 * general RedFlagBanner escalation and any error state. Calm and practical per §4.8 tone
 * guidance — supportive teal, no sirens — but every resource is genuinely tappable
 * (tel:/https via Linking), never bare prose. Copy and resources come from
 * @earlysteps/content (clinical content, gated by docs/clinical-review/), never hardcoded.
 * Renders nothing unless an URGENT flag (self_injury_risk, safety_risk) is present —
 * lower-urgency flags like loss_of_skills stay with the general banner only.
 */
export function CrisisSupportCard({ redFlagTypes }: CrisisSupportCardProps) {
  const isUrgent = redFlagTypes.some((t) =>
    (URGENT_RED_FLAG_TYPES as readonly RedFlagType[]).includes(t),
  );
  if (!isUrgent) return null;

  return (
    <View style={styles.card} accessibilityRole="alert" testID="crisis-support-card">
      <Text style={styles.heading}>{RED_FLAG_COPY.urgent_resource_heading}</Text>
      <Text style={styles.message}>{RED_FLAG_COPY.urgent_resource_message}</Text>
      {RED_FLAG_COPY.urgent_resources.map((resource) => (
        <Pressable
          key={resource.id}
          accessibilityRole="link"
          accessibilityLabel={resource.label}
          onPress={() => {
            // Fire-and-forget: if the device can't open the target there is nothing
            // useful to show the caregiver beyond the guidance text already on screen.
            Linking.openURL(resourceHref(resource)).catch(() => {});
          }}
          style={({ pressed }) => [styles.resource, pressed && styles.resourcePressed]}
          testID={`crisis-resource-${resource.id}`}
        >
          <Text style={styles.resourceLabel}>{resource.label}</Text>
          {resource.description ? (
            <Text style={styles.resourceDescription}>{resource.description}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Distinct from RedFlagBanner (soft fill, hairline accent) — a full supportive-teal
  // border and white field make this read as "here is help", still not an error state.
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#3D8B85',
    padding: spacing.lg,
  },
  heading: {
    ...type.bodyStrong,
    fontSize: 15,
    color: '#1F3A38',
  },
  message: {
    marginTop: spacing.xs,
    fontSize: 14,
    lineHeight: 20,
    color: '#1F3A38',
  },
  resource: {
    marginTop: spacing.md,
    backgroundColor: '#3D8B85',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    justifyContent: 'center',
  },
  resourcePressed: {
    backgroundColor: '#2E6B66',
  },
  resourceLabel: {
    ...type.bodyStrong,
    fontSize: 15,
    color: colors.card,
  },
  resourceDescription: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: '#DFF0EE',
  },
});
