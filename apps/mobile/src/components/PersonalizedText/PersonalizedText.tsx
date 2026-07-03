import { Fragment } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '../../theme/index.js';

/** The placeholder content templates use where the child's name belongs. */
export const CHILD_PLACEHOLDER = '[child]';

/** Plain-string interpolation for contexts that can't nest components (a11y labels). */
export function personalizeText(template: string, name: string): string {
  return template.split(CHILD_PLACEHOLDER).join(name);
}

export interface PersonalizedTextProps {
  /** Raw content template, `[child]` placeholders included. */
  template: string;
  /** The child's name (or a fallback like "your child") substituted for each placeholder. */
  name: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * Renders a content template with every `[child]` placeholder replaced by the child's
 * name, visually emphasized (issue #45) — the one place that owns both the substitution
 * and the emphasis, so copy in questions, hints, and consent explanations all personalize
 * the same way. Falls out naturally to plain text when the template has no placeholder.
 */
export function PersonalizedText({
  template,
  name,
  style,
  testID,
}: PersonalizedTextProps) {
  const segments = template.split(CHILD_PLACEHOLDER);
  return (
    <Text style={style} testID={testID}>
      {segments.map((segment, i) => (
        <Fragment key={i}>
          {segment}
          {i < segments.length - 1 && <Text style={styles.name}>{name}</Text>}
        </Fragment>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  name: {
    fontWeight: '700',
    color: colors.primaryDeep,
  },
});
