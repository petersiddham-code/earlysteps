import { StyleSheet, Text, View } from 'react-native';
import {
  DOMAIN_DISPLAY_NAMES,
  SIGN_LEVEL_TO_LABEL,
  type Confidence,
  type Domain,
  type SignLevel,
} from '@earlysteps/shared-types';

export interface TrafficLightBarProps {
  domain: Domain;
  level: SignLevel;
  confidence: Confidence;
}

/**
 * Traffic-light domain indicator (CLAUDE.md §6, product plan §4.4: "never a single
 * autism-likelihood number"). Deliberately takes `level` (the bucketed SignLevel), not a
 * numeric score — there is no prop through which a raw 0–100 score could be passed in and
 * accidentally rendered.
 */
const LEVEL_COLOR: Record<SignLevel, string> = {
  low: '#2E9E5B', // green
  some: '#D9A400', // amber
  many: '#C0392B', // red
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

export function TrafficLightBar({ domain, level, confidence }: TrafficLightBarProps) {
  const color = LEVEL_COLOR[level];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} accessibilityRole="image" />
      <View style={styles.textColumn}>
        <Text style={styles.domainLabel}>{DOMAIN_DISPLAY_NAMES[domain]}</Text>
        <Text style={styles.levelLabel}>
          {SIGN_LEVEL_TO_LABEL[level]} · {CONFIDENCE_LABEL[confidence]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  textColumn: {
    flex: 1,
  },
  domainLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2933',
  },
  levelLabel: {
    fontSize: 13,
    color: '#5A6672',
  },
});
