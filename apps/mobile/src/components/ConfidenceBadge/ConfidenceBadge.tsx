import { StyleSheet, Text, View } from 'react-native';
import type { Confidence } from '@earlysteps/shared-types';
import { colors, radius, spacing, type } from '../../theme/index.js';

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  testID?: string;
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

/**
 * Small reusable badge pairing a likelihood/level with its confidence (CLAUDE.md §6) — the
 * one shared rendering both Assessment A (`<TrafficLightBar/>`) and Assessment B
 * (`<AIAssessmentCard/>`) use, so a caregiver reads "confidence" the same way regardless of
 * which engine reported it, even though the two values are never merged (rule 3, §2).
 */
export function ConfidenceBadge({ confidence, testID }: ConfidenceBadgeProps) {
  return (
    <View style={styles.badge} testID={testID}>
      <Text style={styles.label}>{CONFIDENCE_LABEL[confidence]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  label: { ...type.caption, color: colors.inkSoft },
});
