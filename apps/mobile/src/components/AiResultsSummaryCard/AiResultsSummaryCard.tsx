import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AI_RESULTS_SUMMARY_COPY } from '@earlysteps/content';
import type { AiResultsSummary } from '@earlysteps/shared-types';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

export interface AiResultsSummaryCardProps {
  /**
   * Null covers every "no section" case by design (issue #104): still loading, the
   * caregiver isn't Premium/consented (ResultsScreen never even calls the endpoint
   * then), or the call failed/was malformed/unsafe (fail closed, CLAUDE.md §8) — none of
   * these get a visible error or teaser state, the card is simply absent, same as
   * FollowUpSuggestions and DomainResourcesCard when they have nothing to show.
   */
  summary: AiResultsSummary | null;
}

/**
 * Collapsible independent AI read of the caregiver's raw answers (issue #104, product
 * plan §9.3), rendered below the deterministic findings on Results. Collapsed by
 * default — generation is kicked off as soon as Results loads (ResultsScreen), not when
 * this section is expanded, so the content is usually already here by the time a
 * caregiver taps it open.
 */
export function AiResultsSummaryCard({ summary }: AiResultsSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;
  const headings = AI_RESULTS_SUMMARY_COPY.section_headings;

  return (
    <View style={styles.card} testID="ai-results-summary-card">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        testID="ai-results-summary-toggle"
      >
        <Text style={styles.heading}>AI assessment</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.inkSoft}
        />
      </Pressable>
      {expanded && (
        <View testID="ai-results-summary-content">
          <Text style={styles.framingNote}>{AI_RESULTS_SUMMARY_COPY.framing_note}</Text>

          <Text style={styles.sectionHeading}>{headings.overview}</Text>
          <Text style={styles.bodyText}>{summary.overview}</Text>

          {summary.strengths.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>{headings.strengths}</Text>
              {summary.strengths.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  {'•'} {item}
                </Text>
              ))}
            </>
          )}

          {summary.areasToWatch.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>{headings.areas_to_watch}</Text>
              {summary.areasToWatch.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  {'•'} {item}
                </Text>
              ))}
            </>
          )}

          {summary.notedByCaregiver.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>{headings.noted_by_caregiver}</Text>
              {summary.notedByCaregiver.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  {'•'} {item}
                </Text>
              ))}
            </>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { ...type.bodyStrong, color: colors.ink },
  framingNote: {
    ...type.caption,
    color: colors.inkSoft,
    fontStyle: 'italic',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeading: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  bodyText: { ...type.body, color: colors.inkSoft },
  listItem: { ...type.body, color: colors.inkSoft, marginBottom: spacing.xs },
});
