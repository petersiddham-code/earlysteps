import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AI_RESULTS_SUMMARY_COPY } from '@earlysteps/content';
import type { AiResultsSummary, AiSupportPriorityItem } from '@earlysteps/shared-types';
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

const SUPPORT_TIERS = ['immediate', 'short_term', 'medium_term', 'long_term'] as const;

function PriorityList({ items }: { items: AiSupportPriorityItem[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item, i) => (
        <Text key={i} style={styles.listItem}>
          {'•'} {item.priority} — {item.reason}
        </Text>
      ))}
    </>
  );
}

/**
 * Collapsible independent AI read of the caregiver's raw answers — Assessment B (issue
 * #104, CLAUDE.md §13), rendered below the deterministic findings on Results. Collapsed by
 * default — generation is kicked off as soon as Results loads (ResultsScreen), not when
 * this section is expanded, so the content is usually already here by the time a
 * caregiver taps it open.
 *
 * v2 (2026-07-11 dual-assessment update, PR 1 of 2): minimal field-shape update only — this
 * still renders as one inline card. The full restructure into a dedicated
 * `<AIAssessmentCard/>` with `<ConfidenceBadge/>`/`<SupportPrioritiesCard/>` subsections
 * (CLAUDE.md §6) is PR 2's scope, tracked alongside the Results screen's Section A/B/
 * Comparison restructure (CLAUDE.md §14).
 */
export function AiResultsSummaryCard({ summary }: AiResultsSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;
  const headings = AI_RESULTS_SUMMARY_COPY.section_headings;
  const hasSupportPriorities = SUPPORT_TIERS.some(
    (tier) => summary.supportPriorities[tier].length > 0,
  );

  return (
    <View style={styles.card} testID="ai-results-summary-card">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        testID="ai-results-summary-toggle"
      >
        <Text style={styles.heading}>{AI_RESULTS_SUMMARY_COPY.card_heading}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.inkSoft}
        />
      </Pressable>
      {expanded && (
        <View testID="ai-results-summary-content">
          <Text style={styles.framingNote}>{AI_RESULTS_SUMMARY_COPY.framing_note}</Text>

          <Text style={styles.sectionHeading}>{headings.likelihood}</Text>
          <Text style={styles.bodyText} testID="ai-summary-likelihood">
            {summary.likelihood} ({summary.confidence} {headings.confidence.toLowerCase()}
            )
          </Text>

          <Text style={styles.sectionHeading}>{headings.reasoning}</Text>
          <Text style={styles.bodyText}>{summary.reasoning}</Text>

          <Text style={styles.sectionHeading}>{headings.developmental_profile}</Text>
          <Text style={styles.bodyText}>{summary.developmentalProfile}</Text>

          {/* Strengths render before support priorities (rule 15, §2). */}
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

          {hasSupportPriorities && (
            <>
              <Text style={styles.sectionHeading}>
                {headings.support_priorities.heading}
              </Text>
              {SUPPORT_TIERS.map((tier) =>
                summary.supportPriorities[tier].length > 0 ? (
                  <View key={tier}>
                    <Text style={styles.tierHeading}>
                      {headings.support_priorities[tier]}
                    </Text>
                    <PriorityList items={summary.supportPriorities[tier]} />
                  </View>
                ) : null,
              )}
            </>
          )}

          <Text style={styles.sectionHeading}>{headings.uncertainty}</Text>
          <Text style={styles.bodyText}>{summary.uncertainty}</Text>

          <Text style={styles.sectionHeading}>{headings.evidence_summary}</Text>
          <Text style={styles.bodyText}>{summary.evidenceSummary}</Text>

          {summary.homeRecommendations.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>{headings.home_recommendations}</Text>
              {summary.homeRecommendations.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  {'•'} {item}
                </Text>
              ))}
            </>
          )}

          {summary.schoolRecommendations.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>{headings.school_recommendations}</Text>
              {summary.schoolRecommendations.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  {'•'} {item}
                </Text>
              ))}
            </>
          )}

          {summary.professionalAssessmentPriorities.length > 0 && (
            <>
              <Text style={styles.sectionHeading}>
                {headings.professional_assessment_priorities}
              </Text>
              {summary.professionalAssessmentPriorities.map((item, i) => (
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
  tierHeading: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  bodyText: { ...type.body, color: colors.inkSoft },
  listItem: { ...type.body, color: colors.inkSoft, marginBottom: spacing.xs },
});
