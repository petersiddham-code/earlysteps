import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Question } from '@earlysteps/shared-types';

export interface QuestionRendererProps {
  question: Question;
  /** Caregiver-facing text with `[child]` already replaced by the child's name. */
  text: string;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}

/**
 * Renders one question per the "no hard questions" rules (product plan §4.1b): closed-choice
 * by default, the example lives in `text` itself, `hint` is always shown, options already
 * include an "I'm not sure" choice where the content calls for one — nothing here invents or
 * hides that, it just renders what @earlysteps/content ships.
 *
 * `buttons` / `dropdown` / `emoji_slider` all render as the same single-select pill list —
 * the content's option labels already carry the visual meaning (e.g. emoji in the label
 * text), so a distinct native-dropdown-wheel UI isn't needed for correctness.
 */
export function QuestionRenderer({
  question,
  text,
  value,
  onChange,
}: QuestionRendererProps) {
  const isMultiSelect = question.type === 'chip_multi_select';
  const selectedIds = isMultiSelect ? ((value as string[]) ?? []) : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>{text}</Text>
      {question.type === 'text' ? (
        <TextInput
          style={styles.input}
          value={(value as string) ?? ''}
          onChangeText={(next) => onChange(next)}
          accessibilityLabel={text}
        />
      ) : (
        <View style={styles.optionRow}>
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
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={styles.hint}>{question.hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  questionText: { fontSize: 16, fontWeight: '600', color: '#1F2933', marginBottom: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: '#D1D9E0',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  optionSelected: { borderColor: '#2E7D6B', backgroundColor: '#E3F2F1' },
  optionText: { fontSize: 14, color: '#1F2933' },
  optionTextSelected: { fontWeight: '600', color: '#1F3A38' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D9E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  hint: { fontSize: 12, color: '#5A6672', marginTop: 6 },
});
