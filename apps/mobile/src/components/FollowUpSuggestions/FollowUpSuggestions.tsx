import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getFollowUp } from '@earlysteps/content';
import {
  FOLLOW_UP_ANSWER_OPTIONS,
  type FollowUpAnswer,
  type FollowUpSuggestion,
} from '@earlysteps/shared-types';
import { PersonalizedText } from '../PersonalizedText/PersonalizedText.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

export interface FollowUpSuggestionsProps {
  suggestions: FollowUpSuggestion[];
  childName: string;
  answeringId: string | null;
  error: string | null;
  onAnswer: (suggestion: FollowUpSuggestion, answer: FollowUpAnswer) => void;
}

/**
 * Closed-choice answers for a confirmation follow-up, labelled from the content package
 * (single source of truth — never hardcoded here, CLAUDE.md §5). Anything off the
 * yes/no/not_sure vocabulary is dropped defensively.
 */
function followUpOptions(
  suggestion: FollowUpSuggestion,
): { id: FollowUpAnswer; label: string }[] {
  const options = getFollowUp(suggestion.follow_up_id)?.options ?? [];
  return options.filter((option): option is { id: FollowUpAnswer; label: string } =>
    (FOLLOW_UP_ANSWER_OPTIONS as readonly string[]).includes(option.id),
  );
}

/**
 * Confirmation follow-ups for things a caregiver typed in their own words (issue #26).
 * The AI only proposed showing these content-authored questions — the caregiver's
 * structured answer goes through the normal deterministic pipeline, which alone decides
 * scores and red flags. Shared by FollowUpCheckScreen (issue #102: before Results ever
 * renders) and ResultsScreen (a safety net for anything still pending).
 */
export function FollowUpSuggestions({
  suggestions,
  childName,
  answeringId,
  error,
  onAnswer,
}: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.card} testID="follow-up-card">
      <Text style={styles.heading}>About something you wrote</Text>
      <Text style={styles.intro}>
        Your own words matter. To be sure we understood them, here's a quick question —
        your answer is what counts, and "I'm not sure" is always fine.
      </Text>
      {suggestions.map((suggestion) => (
        <View
          key={suggestion.id}
          style={styles.item}
          testID={`follow-up-${suggestion.follow_up_id}`}
        >
          <Text style={styles.quote}>"{suggestion.source_quote}"</Text>
          <PersonalizedText
            template={suggestion.text}
            name={childName}
            style={styles.question}
          />
          <PersonalizedText
            template={suggestion.hint}
            name={childName}
            style={styles.hint}
          />
          <View style={styles.options}>
            {followUpOptions(suggestion).map((option) => (
              <Pressable
                key={option.id}
                onPress={() => onAnswer(suggestion, option.id)}
                disabled={answeringId !== null}
                accessibilityRole="button"
                style={[styles.option, answeringId !== null && styles.optionDisabled]}
                testID={`follow-up-${suggestion.follow_up_id}-${option.id}`}
              >
                <Text style={styles.optionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  heading: { ...type.title, color: colors.ink, marginBottom: spacing.xs },
  intro: { ...type.caption, color: colors.inkSoft, marginBottom: spacing.lg },
  item: { marginBottom: spacing.md },
  quote: {
    ...type.body,
    color: colors.inkSoft,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  question: { ...type.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  hint: { ...type.caption, color: colors.inkSoft, marginBottom: spacing.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionDisabled: { opacity: 0.5 },
  optionText: { ...type.bodyStrong, color: colors.ink },
  errorText: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
});
