import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Question } from '@earlysteps/shared-types';
import { DomainIcon } from '../../components/DomainIcon/DomainIcon.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

export interface QuestionRendererProps {
  question: Question;
  /** Caregiver-facing text with `[child]` already replaced by the child's name. */
  text: string;
  /** The question's hint, also with `[child]` already replaced. */
  hint: string;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}

/**
 * Renders one question per the "no hard questions" rules (product plan §4.1b): closed-choice
 * by default, the example lives in `text` itself, `hint` is always shown, options already
 * include an "I'm not sure" choice where the content calls for one — nothing here invents or
 * hides that, it just renders what @earlysteps/content ships.
 *
 * Revamped for the one-question-at-a-time flow (issue #16): one large card, a soft domain
 * icon for visual variety, the hint directly under the question so it's read *before*
 * answering (it's reassurance, not an afterthought), and full-width tap targets sized for
 * a tired thumb. `buttons` / `dropdown` / `emoji_slider` all render as the same
 * single-select option list — the content's option labels already carry the visual meaning.
 */
export function QuestionRenderer({
  question,
  text,
  hint,
  value,
  onChange,
}: QuestionRendererProps) {
  const isMultiSelect = question.type === 'chip_multi_select';
  const selectedIds = isMultiSelect ? ((value as string[]) ?? []) : undefined;

  return (
    <View style={styles.card}>
      <DomainIcon domain={question.domain} />
      <Text style={styles.questionText}>{text}</Text>
      <Text style={styles.hint}>{hint}</Text>
      {question.type === 'text' ? (
        <TextInput
          style={styles.input}
          value={(value as string) ?? ''}
          onChangeText={(next) => onChange(next)}
          accessibilityLabel={text}
          multiline
        />
      ) : (
        <View style={styles.optionList}>
          {question.options.map((option) => {
            const selected = isMultiSelect
              ? (selectedIds?.includes(option.id) ?? false)
              : value === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  if (isMultiSelect) {
                    const current = selectedIds ?? [];
                    onChange(
                      current.includes(option.id)
                        ? current.filter((id) => id !== option.id)
                        : [...current, option.id],
                    );
                  } else {
                    onChange(option.id);
                  }
                }}
                style={[styles.option, selected && styles.optionSelected]}
                accessibilityRole={isMultiSelect ? 'checkbox' : 'button'}
                accessibilityState={isMultiSelect ? { checked: selected } : { selected }}
              >
                {/* Square checkbox for "pick all that apply", round radio for pick-one —
                    the shape signals the behaviour difference (multi-selects wait for
                    Next; single-selects advance on tap). */}
                {isMultiSelect ? (
                  <View
                    style={[styles.checkbox, selected && styles.checkboxSelected]}
                    testID={`option-checkbox-${option.id}`}
                  >
                    {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                ) : (
                  <View
                    style={[styles.radio, selected && styles.radioSelected]}
                    testID={`option-radio-${option.id}`}
                  />
                )}
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    ...cardShadow,
  },
  questionText: {
    ...type.question,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  hint: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionList: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
  },
  radioSelected: {
    borderColor: colors.primary,
    borderWidth: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    ...type.body,
    fontSize: 16,
    color: colors.ink,
    flex: 1,
  },
  optionTextSelected: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.primaryDeep,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
