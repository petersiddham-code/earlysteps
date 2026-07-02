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
import { Ionicons } from '@expo/vector-icons';
import { getQuestionBank } from '@earlysteps/content';
import type { Child, IntakeResponse, Question } from '@earlysteps/shared-types';
import { getChild, submitIntakeResponses } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton, SteppingStones } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';
import { QuestionRenderer } from './QuestionRenderer.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;
type Answer = string | string[];

/**
 * A question the caregiver can actually answer on this screen: free-text, or at least one
 * closed-choice option. Filters out picker-style questions whose options aren't populated
 * yet (e.g. U1's age dropdown, which duplicates Child Profile Setup anyway) so nothing
 * renders as a dead prompt with no way to respond.
 */
function isAnswerable(question: Question): boolean {
  return question.type === 'text' || question.options.length > 0;
}

/** An answer that counts as given: defined, and not an empty multi-select / blank text. */
function isAnswered(answer: Answer | undefined): answer is Answer {
  if (answer === undefined) return false;
  if (Array.isArray(answer)) return answer.length > 0;
  return answer.trim().length > 0;
}

/**
 * Product plan Screen 4 / §4.1, revamped per issue #16 into a one-question-at-a-time flow:
 * ~26 questions in a single scroll exhausted tired caregivers, so each question now gets a
 * full-screen card, tapping an answer auto-advances, and progress reads as a stepping-stone
 * path (the app's signature element) rather than a wall of remaining work.
 *
 * Questions come from the universal bank plus the child's age-band bank in
 * @earlysteps/content — never hardcoded here (CLAUDE.md §5). Nothing is required: every
 * question has a Skip, matching "I'm not sure is always an option, never a trap" (§4.1b) —
 * the scoring engine treats sparse data safely (confidence caps at low), so partial answers
 * are a normal, supported case. Only answered questions are submitted, in one batch from
 * the review step, exactly as before the redesign.
 */
export function QuestionnaireScreen({ navigation }: Props) {
  const { familyId, childId } = useSession();
  const [child, setChild] = useState<Child | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [consentDenied, setConsentDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!familyId || !childId) return;
    let cancelled = false;
    setError(null);
    getChild(familyId, childId)
      .then((fetchedChild) => {
        if (cancelled) return;
        setChild(fetchedChild);
        const universal = getQuestionBank('universal')?.questions ?? [];
        const ageBand = getQuestionBank(fetchedChild.age_band)?.questions ?? [];
        setQuestions([...universal, ...ageBand].filter(isAnswerable));
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load the questions. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [familyId, childId, attempt]);

  const handleSubmit = async () => {
    if (!childId) return;
    setSubmitting(true);
    setError(null);
    setConsentDenied(false);
    const now = new Date().toISOString();
    const responses: Omit<IntakeResponse, 'child_id'>[] = questions
      .filter((q) => isAnswered(answers[q.id]))
      .map((q) => ({
        question_id: q.id,
        domain: q.domain,
        answer: answers[q.id]!,
        timestamp: now,
      }));

    try {
      await submitIntakeResponses(childId, responses);
      navigation.replace('Results');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // Saving answers needs data_storage consent — send them back to grant it, don't
        // leave them retrying a request that can never succeed.
        setConsentDenied(true);
      } else {
        setError("We couldn't save your answers. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !child) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const total = questions.length;
  const onReviewStep = index >= total;
  const question = onReviewStep ? null : questions[index];
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;
  // A gentle lift at the path's midpoint — only worth marking on a longer walk.
  const isHalfway = !onReviewStep && total >= 8 && index === Math.floor(total / 2);

  const goForward = () => setIndex((i) => Math.min(i + 1, total));
  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  const handleAnswer = (q: Question, next: Answer) => {
    setAnswers((prev) => ({ ...prev, [q.id]: next }));
    // One tap = one step forward: single-select answers advance immediately.
    // Multi-select and free text keep collecting until "Next".
    if (q.type !== 'chip_multi_select' && q.type !== 'text') goForward();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ABOUT {child.nickname.toUpperCase()}</Text>
        <SteppingStones total={total} currentIndex={index} />
        <Text style={styles.progressLabel}>
          {onReviewStep ? 'All steps walked' : `Question ${index + 1} of ${total}`}
        </Text>
      </View>

      {isHalfway && (
        <View style={styles.encouragement} testID="halfway-encouragement">
          <Ionicons name="footsteps-outline" size={18} color={colors.accent} />
          <Text style={styles.encouragementText}>
            Halfway there — you're doing great. Pause any time; your answers wait for you.
          </Text>
        </View>
      )}

      {question && (
        <>
          <QuestionRenderer
            key={question.id}
            question={question}
            text={question.text.replace(/\[child\]/g, child.nickname)}
            hint={question.hint.replace(/\[child\]/g, child.nickname)}
            value={answers[question.id]}
            onChange={(next) => handleAnswer(question, next)}
          />

          {/* Every question shows Next (disabled until answered), so the screen never
              loses its forward affordance — before this, single-selects relied purely on
              tap-to-advance, which left no way forward after coming Back to an answered
              one except re-tapping the answer or a misleading "Skip". */}
          <View style={styles.nextButton}>
            <PrimaryButton
              label="Next"
              onPress={goForward}
              disabled={!isAnswered(answers[question.id])}
              testID="next-button"
            />
          </View>

          <View style={styles.footerNav}>
            <Pressable
              onPress={goBack}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel="Back to the previous question"
              style={[styles.footerLink, index === 0 && styles.footerLinkHidden]}
              testID="back-button"
            >
              <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
              <Text style={styles.footerLinkText}>Back</Text>
            </Pressable>
            <Pressable
              onPress={goForward}
              accessibilityRole="button"
              accessibilityLabel="Skip this question"
              style={styles.footerLink}
              testID="skip-button"
            >
              <Text style={styles.footerLinkText}>Skip</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
            </Pressable>
          </View>
        </>
      )}

      {onReviewStep && (
        <View style={styles.reviewCard}>
          <View style={styles.reviewIcon}>
            <Ionicons name="footsteps-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.reviewHeading}>That's every question</Text>
          <Text style={styles.reviewBody}>
            You answered {answeredCount} of {total}. Skipped ones are completely fine — we
            only use what you chose to share, and you can always come back.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}
          {consentDenied && (
            <View style={styles.consentNotice}>
              <Text style={styles.consentNoticeText}>
                To keep your answers, we first need your permission to save them. You can
                turn that on in a moment — your answers here will stay on this screen.
              </Text>
              <Pressable
                testID="update-permissions-button"
                onPress={() => navigation.navigate('ConsentCenter')}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Update my permissions</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.submitButtonWrapper}>
            <PrimaryButton
              label="See what we noticed"
              onPress={handleSubmit}
              loading={submitting}
              testID="submit-button"
            />
            <PrimaryButton
              label="Back to the questions"
              onPress={goBack}
              variant="quiet"
              testID="review-back-button"
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  header: { marginBottom: spacing.xl },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  encouragement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  encouragementText: {
    ...type.caption,
    color: colors.ink,
    flex: 1,
  },
  nextButton: { marginTop: spacing.lg },
  footerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  footerLinkHidden: { opacity: 0 },
  footerLinkText: { ...type.bodyStrong, color: colors.inkSoft },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    ...cardShadow,
  },
  reviewIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  reviewHeading: { ...type.title, color: colors.ink, marginBottom: spacing.sm },
  reviewBody: { ...type.body, color: colors.inkSoft },
  errorText: {
    ...type.body,
    color: colors.error,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  retryText: {
    ...type.bodyStrong,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  consentNotice: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginVertical: spacing.md,
  },
  consentNoticeText: { ...type.body, color: colors.ink },
  submitButtonWrapper: { marginTop: spacing.xl, gap: spacing.sm },
});
