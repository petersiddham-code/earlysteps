import { StyleSheet, Text, View } from 'react-native';
import { COMPARISON_COPY } from '@earlysteps/content';
import {
  COMPARISON_REASON_LABELS,
  COMPARISON_STATUS_LABELS,
  type ComparisonResult,
} from '@earlysteps/shared-types';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

export interface ComparisonCardProps {
  /**
   * Null covers every "no section" case (no Assessment B narrative yet, consent/tier
   * gate, or a fetch failure) — same fail-closed contract as every other AI-assisted card
   * in this app (CLAUDE.md §8). The card is simply absent, never a visible error state.
   */
  comparison: ComparisonResult | null;
}

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  agreement: { backgroundColor: '#E4F3EA', color: '#1F7A4D' },
  partial_agreement: { backgroundColor: '#FBF0D9', color: '#8A6416' },
  disagreement: { backgroundColor: '#FBE6E4', color: '#A5362A' },
};

/**
 * The Comparison Section (CLAUDE.md §13/§14, rule 14 §2) — agreement / partial agreement /
 * disagreement between Assessment A and Assessment B, always visually separate from both
 * (never merged, averaged, or reconciled into one number or label). `comparison.narrative`
 * is entirely deterministic, templated content (`@earlysteps/comparison-engine`) — never
 * LLM-generated — and already includes the non-suppressible red-flag safety sentence when
 * applicable (rule 8, §2), so this component never needs its own red-flag branch.
 */
export function ComparisonCard({ comparison }: ComparisonCardProps) {
  if (!comparison) return null;

  return (
    <View style={styles.card} testID="comparison-card">
      <Text style={styles.heading}>{COMPARISON_COPY.card_heading}</Text>
      <View
        style={[styles.statusPill, STATUS_STYLE[comparison.status]]}
        testID="comparison-status"
      >
        <Text
          style={[styles.statusText, { color: STATUS_STYLE[comparison.status].color }]}
        >
          {COMPARISON_STATUS_LABELS[comparison.status]}
        </Text>
      </View>
      <Text style={styles.narrative} testID="comparison-narrative">
        {comparison.narrative}
      </Text>
      {comparison.reasons.length > 0 && (
        <View style={styles.tagRow} testID="comparison-reasons">
          {comparison.reasons.map((reason) => (
            <View key={reason} style={styles.tag}>
              <Text style={styles.tagText}>{COMPARISON_REASON_LABELS[reason]}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...cardShadow,
  },
  heading: { ...type.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusText: { ...type.bodyStrong },
  narrative: { ...type.body, color: colors.inkSoft },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tag: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { ...type.caption, color: colors.inkSoft },
});
