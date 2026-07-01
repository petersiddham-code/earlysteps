import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SCREENING_DISCLAIMER } from '@earlysteps/shared-types';

export interface ScreeningDisclaimerProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * The fixed disclaimer sentence (CLAUDE.md §2 rule 5, §6). Text comes directly from
 * SCREENING_DISCLAIMER in @earlysteps/shared-types — never paraphrased, never a prop, so
 * there is no way to render this component with different wording.
 *
 * Every screen that shows a result, summary, or report must render this component. Do not
 * let a results/report code path skip it.
 */
export function ScreeningDisclaimer({ style }: ScreeningDisclaimerProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="text">
      <Text style={styles.text}>{SCREENING_DISCLAIMER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F4F8',
    borderRadius: 8,
    padding: 12,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    color: '#3A4A5A',
  },
});
