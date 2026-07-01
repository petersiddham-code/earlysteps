import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getQuestionBank } from '@earlysteps/content';
import type { Child, IntakeResponse, Question } from '@earlysteps/shared-types';
import { getChild, submitIntakeResponses } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { QuestionRenderer } from './QuestionRenderer.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;
type Answer = string | string[];

/**
 * Product plan Screen 4 / §4.1. Renders the universal questions plus the child's age-band
 * bank from @earlysteps/content — never hardcoded here (CLAUDE.md §5). Nothing is required:
 * only answered questions are submitted, matching the "I'm not sure is always an option, never
 * a trap" rule (§4.1b) — the scoring engine already treats sparse data safely (confidence
 * caps at low), so partial answers are a normal, supported case, not an error state.
 */
export function QuestionnaireScreen({ navigation }: Props) {
  const { familyId, childId } = useSession();
  const [child, setChild] = useState<Child | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!familyId || !childId) return;
    getChild(familyId, childId)
      .then((fetchedChild) => {
        setChild(fetchedChild);
        const universal = getQuestionBank('universal')?.questions ?? [];
        const ageBand = getQuestionBank(fetchedChild.age_band)?.questions ?? [];
        setQuestions([...universal, ...ageBand]);
      })
      .catch(() => setError("We couldn't load the questions. Please try again."));
  }, [familyId, childId]);

  const handleSubmit = async () => {
    if (!childId) return;
    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();
    const responses: Omit<IntakeResponse, 'child_id'>[] = questions
      .filter((q) => {
        const a = answers[q.id];
        return a !== undefined && !(Array.isArray(a) && a.length === 0);
      })
      .map((q) => ({
        question_id: q.id,
        domain: q.domain,
        answer: answers[q.id]!,
        timestamp: now,
      }));

    try {
      await submitIntakeResponses(childId, responses);
      navigation.replace('Results');
    } catch {
      setError("We couldn't save your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && questions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => setError(null)}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>A few questions about {child.nickname}</Text>
      <Text style={styles.subheading}>
        Pick your best guess — you can skip anything and come back later.
      </Text>

      {questions.map((question) => (
        <QuestionRenderer
          key={question.id}
          question={question}
          text={question.text.replace(/\[child\]/g, child.nickname)}
          value={answers[question.id]}
          onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
        />
      ))}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.submitButtonWrapper}>
        {submitting ? (
          <ActivityIndicator />
        ) : (
          <Pressable
            testID="submit-button"
            onPress={handleSubmit}
            style={styles.submitButton}
            accessibilityRole="button"
          >
            <Text style={styles.submitButtonText}>See what we noticed</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  heading: { fontSize: 20, fontWeight: '700', color: '#1F2933', marginBottom: 6 },
  subheading: { fontSize: 13, color: '#5A6672', marginBottom: 24 },
  errorText: { fontSize: 14, color: '#C0392B', textAlign: 'center', marginVertical: 12 },
  retryText: { fontSize: 15, color: '#2E7D6B', fontWeight: '600', marginTop: 8 },
  submitButtonWrapper: { marginTop: 12 },
  submitButton: {
    backgroundColor: '#2E7D6B',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
