import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Question } from '@earlysteps/shared-types';
import { colors, radius } from '../../theme/index.js';

export interface DomainIconProps {
  domain: Question['domain'];
  size?: number;
}

/**
 * A soft, decorative icon for a question's developmental domain — visual variety for a
 * long questionnaire without adding any words. Deliberately icon-only: surfacing domain
 * *names* over each question could read as clinical framing or lead the answer, so the
 * imagery stays gentle and unlabeled (marked as not-for-accessibility below).
 */
const DOMAIN_ICON: Record<Question['domain'], keyof typeof Ionicons.glyphMap> = {
  communication: 'chatbubbles-outline',
  social: 'people-outline',
  repetitive_behaviour: 'sync-outline',
  sensory: 'ear-outline',
  learning: 'book-outline',
  attention: 'eye-outline',
  motor: 'bicycle-outline',
  emotional_regulation: 'heart-outline',
  daily_living: 'home-outline',
  profile: 'person-circle-outline',
  strengths: 'star-outline',
};

export function DomainIcon({ domain, size = 44 }: DomainIconProps) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: radius.pill }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={`domain-icon-${domain}`}
    >
      <Ionicons
        name={DOMAIN_ICON[domain] ?? 'help-circle-outline'}
        size={Math.round(size * 0.5)}
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
