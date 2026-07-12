import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AI_RESULTS_SUMMARY_COPY } from '@earlysteps/content';
import {
  UNCERTAINTY_FACTOR_LABELS,
  type AiResultsSummary,
} from '@earlysteps/shared-types';
import { ConfidenceBadge } from '../ConfidenceBadge/ConfidenceBadge.js';
import { SupportPrioritiesCard } from '../SupportPrioritiesCard/SupportPrioritiesCard.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

export interface AIAssessmentCardProps {
  /**
   * Null covers every "no section" case by design (issue #104): still loading, the
   * caregiver isn't Premium/consented (ResultsScreen never even calls the endpoint
   * then), or the call failed/was malformed/unsafe (fail closed, CLAUDE.md §8) — none of
   * these get a visible error or teaser state, the card is simply absent, same as every
   * other AI-assisted card in this app.
   */
  summary: AiResultsSummary | null;
}

/**
 * Collapsible independent AI read of the caregiver's raw answers — Assessment B (CLAUDE.md
 * §13), rendered as its own visually distinct section on Results (§14), never merged with
 * Assessment A. Collapsed by default — generation is kicked off as soon as Results loads
 * (ResultsScreen), not when this section is expanded, so the content is usually already
 * here by the time a caregiver taps it open.
 *
 * Replaces the pre-dual-assessment `AiResultsSummaryCard` (issue #104 PR 2, CLAUDE.md §6).
 * Strengths render before `<SupportPrioritiesCard/>` in JSX source order — the concrete
 * mechanism enforcing rule 15 for Assessment B, the same way `<StrengthsFirstList/>`
 * enforces it structurally for Assessment A.
 */
export function AIAssessmentCard({ summary }: AIAssessmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) return null;
  const headings = AI_RESULTS_SUMMARY_COPY.section_headings;

  return (
    <View style={styles.card} testID="ai-assessment-card">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        testID="ai-assessment-toggle"
      >
        <Text style={styles.heading}>{AI_RESULTS_SUMMARY_COPY.card_heading}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.inkSoft}
        />
      </Pressable>
      {expanded && (
        <View testID="ai-assessment-content">
          <Text style={styles.framingNote}>{AI_RESULTS_SUMMARY_COPY.framing_note}</Text>

          <Text style={styles.sectionHeading}>{headings.likelihood}</Text>
          <View style={styles.likelihoodRow}>
            <Text style={styles.likelihoodText} testID="ai-assessment-likelihood">
              {summary.likelihood}
            </Text>
            <ConfidenceBadge
              confidence={summary.confidence}
              testID="ai-assessment-confidence"
            />
          </View>

          <Text style={styles.sectionHeading}>{headings.reasoning}</Text>
          <Text style={styles.bodyText}>{summary.reasoning}</Text>

          <Text style={styles.sectionHeading}>{headings.developmental_profile}</Text>
          <Text style={styles.bodyText}>{summary.developmentalProfile}</Text>

          {/* Strengths render before support priorities — rule 15 (§2), enforced here by
              JSX source order, same mechanism <StrengthsFirstList/> uses for Assessment A. */}
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

          <SupportPrioritiesCard
            priorities={summary.supportPriorities}
            headings={headings.support_priorities}
          />

          <Text style={styles.sectionHeading}>{headings.uncertainty}</Text>
          <Text style={styles.bodyText}>{summary.uncertainty}</Text>
          {summary.uncertaintyFactors.length > 0 && (
            <View style={styles.tagRow}>
              {summary.uncertaintyFactors.map((factor) => (
                <View key={factor} style={styles.tag}>
                  <Text style={styles.tagText}>{UNCERTAINTY_FACTOR_LABELS[factor]}</Text>
                </View>
              ))}
            </View>
          )}

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
  bodyText: { ...type.body, color: colors.inkSoft },
  listItem: { ...type.body, color: colors.inkSoft, marginBottom: spacing.xs },
  likelihoodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  likelihoodText: { ...type.bodyStrong, color: colors.ink },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { ...type.caption, color: colors.inkSoft },
});
