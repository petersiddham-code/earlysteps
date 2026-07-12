import { StyleSheet, Text, View } from 'react-native';

export interface StrengthsFirstListProps {
  strengths: string[];
  needs: string[];
}

/**
 * Enforces strengths-before-needs ordering at the component level (CLAUDE.md §2 rule 6, §6),
 * structurally, not by convention: `strengths` and `needs` are separate required props, and
 * this component always renders the strengths section first internally — there is no prop
 * (like a single merged/orderable array) through which a caller could accidentally flip the
 * order downstream.
 */
export function StrengthsFirstList({ strengths, needs }: StrengthsFirstListProps) {
  // Nothing on either side (e.g. every question skipped, #32): render nothing at all —
  // two bare headings over empty space read as a rendering bug, not an honest gap.
  if (strengths.length === 0 && needs.length === 0) return null;
  return (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Strengths</Text>
        {strengths.map((strength, index) => (
          // Keyed by index, not text (issue #106): two different questions can produce
          // the same free-text answer, and keying by content collides in that case.
          // Safe here — this list is never reordered, just recomputed fresh per render.
          <Text key={index} style={styles.item}>
            {strength}
          </Text>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Support needs</Text>
        {needs.map((need, index) => (
          <Text key={index} style={styles.item}>
            {need}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: '#24403B',
  },
  item: {
    fontSize: 14,
    lineHeight: 20,
    color: '#5C6F69',
  },
});
