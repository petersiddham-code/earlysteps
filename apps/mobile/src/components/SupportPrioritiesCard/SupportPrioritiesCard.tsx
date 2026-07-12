import { StyleSheet, Text, View } from 'react-native';
import type { AiSupportPriorities } from '@earlysteps/shared-types';
import { colors, radius, spacing, type } from '../../theme/index.js';

const TIERS = ['immediate', 'short_term', 'medium_term', 'long_term'] as const;

export interface SupportPrioritiesCardHeadings {
  heading: string;
  immediate: string;
  short_term: string;
  medium_term: string;
  long_term: string;
}

export interface SupportPrioritiesCardProps {
  priorities: AiSupportPriorities;
  /** Content-driven per-tier headings (CLAUDE.md §5) — never hardcoded in this component. */
  headings: SupportPrioritiesCardHeadings;
}

/**
 * Assessment B's tiered support priorities (CLAUDE.md §13) — Immediate / Short-term /
 * Medium-term / Long-term, each item paired with its own stated reason. Kept independently
 * reusable (CLAUDE.md §6) rather than folded directly into `<AIAssessmentCard/>`, e.g. for a
 * future clinician-facing report that only needs this section. Renders nothing when every
 * tier is empty — the model is never forced to invent a priority it has no evidence for.
 */
export function SupportPrioritiesCard({
  priorities,
  headings,
}: SupportPrioritiesCardProps) {
  const nonEmptyTiers = TIERS.filter((tier) => priorities[tier].length > 0);
  if (nonEmptyTiers.length === 0) return null;

  return (
    <View testID="support-priorities-card">
      <Text style={styles.heading}>{headings.heading}</Text>
      {nonEmptyTiers.map((tier) => (
        <View key={tier} style={styles.tier} testID={`support-priorities-tier-${tier}`}>
          <Text style={styles.tierHeading}>{headings[tier]}</Text>
          {priorities[tier].map((item, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.priority}>{item.priority}</Text>
              <Text style={styles.reason}>{item.reason}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  tier: { marginTop: spacing.sm },
  tierHeading: {
    ...type.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  item: {
    borderRadius: radius.md,
    backgroundColor: colors.background,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  priority: { ...type.bodyStrong, color: colors.ink, marginBottom: 2 },
  reason: { ...type.caption, color: colors.inkSoft },
});
