import { StyleSheet, View } from 'react-native';
import { colors } from '../../theme/index.js';

export interface SteppingStonesProps {
  /** Total number of steps on the path. */
  total: number;
  /** 0-based index of the step the caregiver is on. Stones before it render filled. */
  currentIndex: number;
  /**
   * Per-step answered flags, same order as the steps. A crossed stone fills teal only if
   * its question was answered; a crossed-but-skipped stone stays a hollow outline, so the
   * path never claims progress the caregiver didn't give (#37 — all-green after skipping
   * everything contradicted "You answered 0 of N"). Omitted: every crossed stone fills.
   */
  answered?: readonly boolean[];
}

/**
 * The app's signature progress element: a gently winding path of stepping stones —
 * echoing the EarlySteps name — instead of a clinical progress bar. Stones already
 * crossed fill with the brand teal, the stone underfoot glows warm apricot, and the
 * rest of the path waits quietly ahead.
 *
 * Plain Views only (no SVG dependency): each stone is a small elliptical pebble,
 * alternating a subtle vertical offset to suggest a footpath rather than a ruler.
 */
export function SteppingStones({ total, currentIndex, answered }: SteppingStonesProps) {
  if (total <= 0) return null;
  const clamped = Math.min(Math.max(currentIndex, 0), total);

  return (
    <View
      style={styles.path}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${Math.min(clamped + 1, total)} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: clamped }}
      testID="stepping-stones"
    >
      {Array.from({ length: total }, (_, i) => {
        const state =
          i < clamped
            ? (answered?.[i] ?? true)
              ? 'done'
              : 'skipped'
            : i === clamped
              ? 'current'
              : 'ahead';
        return (
          <View key={i} style={[styles.slot, i % 2 === 1 && styles.slotLow]}>
            <View
              testID={`stone-${state}`}
              style={[
                styles.stone,
                state === 'done' && styles.stoneDone,
                state === 'skipped' && styles.stoneSkipped,
                state === 'current' && styles.stoneCurrent,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed height: the current stone is larger and slots alternate a vertical offset,
  // so without it the row's height (and everything below, like the fixed nav bar)
  // would wobble a few pixels from question to question.
  path: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    marginTop: -3,
  },
  slotLow: {
    marginTop: 3,
  },
  // A pebble, not a dot: slightly wider than tall.
  stone: {
    width: 11,
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  stoneDone: {
    backgroundColor: colors.primary,
  },
  // Crossed but not answered: a hollow pebble — visibly "stepped past", never "filled".
  stoneSkipped: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.disabled,
  },
  stoneCurrent: {
    width: 14,
    height: 11,
    borderRadius: 7,
    backgroundColor: colors.accent,
  },
});
