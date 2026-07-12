import { StyleSheet, Text, View } from 'react-native';
import {
  DOMAIN_DISPLAY_NAMES,
  INSUFFICIENT_EVIDENCE_LABEL,
  SIGN_LEVEL_TO_LABEL,
  type Confidence,
  type Domain,
  type SignLevel,
} from '@earlysteps/shared-types';
import { ConfidenceBadge } from '../ConfidenceBadge/ConfidenceBadge.js';

/**
 * Either a real bucketed level (which must always come with its confidence, CLAUDE.md §2
 * rule 3) or the minimum-evidence "not enough information yet" state (issue #22), which
 * carries NO level and no confidence — the union makes rendering a sign-level label from
 * too few answers a compile error, not a review catch.
 */
export type TrafficLightBarProps =
  | { domain: Domain; level: SignLevel; confidence: Confidence }
  | { domain: Domain; level: 'insufficient_evidence' };

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

/** Deliberately OFF the traffic-light palette: "not enough info" is not a fourth severity. */
const INSUFFICIENT_COLOR = '#9AA8A3';

export function TrafficLightBar(props: TrafficLightBarProps) {
  const insufficient = props.level === 'insufficient_evidence';
  const color = insufficient ? INSUFFICIENT_COLOR : LEVEL_COLOR[props.level];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} accessibilityRole="image" />
      <View style={styles.textColumn}>
        <Text style={styles.domainLabel}>{DOMAIN_DISPLAY_NAMES[props.domain]}</Text>
        <Text style={styles.levelLabel}>
          {props.level === 'insufficient_evidence'
            ? INSUFFICIENT_EVIDENCE_LABEL
            : SIGN_LEVEL_TO_LABEL[props.level]}
        </Text>
        {/* Confidence rendering shared with Assessment B (CLAUDE.md §6) — extracted into
            <ConfidenceBadge/> so both engines report confidence with the same visual
            language, even though the two values are never merged (rule 3, §2). */}
        {!insufficient && <ConfidenceBadge confidence={props.confidence} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
  },
  domainLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#24403B',
  },
  levelLabel: {
    fontSize: 13,
    color: '#5C6F69',
  },
});
