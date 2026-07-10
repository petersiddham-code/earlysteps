import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  EVIDENCE_FLOORS,
  getQuestionBank,
  isAskedInQuestionnaire,
} from '@earlysteps/content';
import {
  isFreeTextAnswer,
  makeFreeTextAnswer,
  OTHER_OPTION_ID,
  type Child,
  type IntakeResponse,
  type Question,
} from '@earlysteps/shared-types';
import { getChild, getIntakeResponses, submitIntakeResponses } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { canUseAiFeatures, useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton, SteppingStones } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';
import { QuestionRenderer } from './QuestionRenderer.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Questionnaire'>;
type Answer = string | string[];

/**
 * Pause between tapping a single-select answer and moving to the next question, so the
 * caregiver sees their selection register before the card changes — an instant jump
 * reads as "did it take my answer?".
 */
export const AUTO_ADVANCE_DELAY_MS = 450;

/**
 * A question the caregiver can actually answer on this screen: free-text, or at least one
 * closed-choice option. Safety net against a bank entry whose options aren't populated,
 * so nothing renders as a dead prompt with no way to respond. Deliberate exclusions are
 * a different concern, carried by the content data itself: questions already answered
 * during Child Profile Setup (age U1, family languages U2) are flagged
 * `collected_at: "profile_setup"` in the bank and dropped via isAskedInQuestionnaire()
 * — a tired caregiver is never asked the same thing twice (#24).
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
 * Issue #102: whether this submission batch carries any caregiver-typed text at all —
 * decides whether the FollowUpCheck interim step runs before Results. A guest or
 * free-tier session can never produce true here (the free-text box is disabled for
 * them, #99), but the check is cheap insurance rather than trusting that indirectly.
 */
function hasFreeTextAnswer(responses: Omit<IntakeResponse, 'child_id'>[]): boolean {
  return responses.some((r) =>
    Array.isArray(r.answer)
      ? r.answer.some(isFreeTextAnswer)
      : typeof r.answer === 'string' && isFreeTextAnswer(r.answer),
  );
}

/**
 * Folds an optional caregiver-typed note into the submitted answer. Free text rides in
 * the same answer array as the selected option ids, namespaced with the free_text:
 * prefix so it can never collide with an option id downstream (scoring weights unknown
 * entries as 0; red-flag rules compare exact option ids). Typed text alone — no option
 * picked — is still a valid answer: "my son doesn't like kids crying" is real evidence.
 */
function mergeAnswer(
  selected: Answer | undefined,
  freeText: string | undefined,
  otherText?: string,
): Answer | undefined {
  // "Other — type it" text (#28) rides the same free_text channel as the note box — the
  // typed language/answer belongs with the 'other' option id it elaborates.
  const notes = [otherText?.trim(), freeText?.trim()].filter(
    (note): note is string => !!note,
  );
  if (notes.length === 0) return isAnswered(selected) ? selected : undefined;
  const base = !isAnswered(selected)
    ? []
    : Array.isArray(selected)
      ? selected
      : [selected];
  return [...base, ...notes.map(makeFreeTextAnswer)];
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
  const { familyId, childId, isGuest, tier } = useSession();
  const [child, setChild] = useState<Child | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [freeTexts, setFreeTexts] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [consentDenied, setConsentDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardAnim = useRef(new Animated.Value(1)).current;

  const clearAdvanceTimer = () => {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  // Clear any pending auto-advance if the screen unmounts mid-pause.
  useEffect(() => clearAdvanceTimer, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(enabled === true))
      .catch(() => {});
  }, []);

  // Ease each question card in (fade + small rise); reduced-motion users get an
  // immediate swap instead. Must live above the early returns below (rules of hooks).
  useEffect(() => {
    if (reduceMotion) {
      cardAnim.setValue(1);
      return;
    }
    cardAnim.setValue(0);
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [index, reduceMotion, cardAnim]);

  useEffect(() => {
    if (!familyId || !childId) return;
    let cancelled = false;
    setError(null);
    Promise.all([
      getChild(familyId, childId),
      // Answered questions are never re-asked (#42): a caregiver returning from gated
      // results walks only the gaps. Failing open to the full bank is safe — worst case
      // a question is asked again (latest answer wins server-side), never lost.
      getIntakeResponses(childId).catch(() => [] as IntakeResponse[]),
    ])
      .then(([fetchedChild, priorResponses]) => {
        if (cancelled) return;
        setChild(fetchedChild);
        const answeredIds = new Set(priorResponses.map((r) => r.question_id));
        const universal = getQuestionBank('universal')?.questions ?? [];
        const ageBand = getQuestionBank(fetchedChild.age_band)?.questions ?? [];
        setQuestions(
          [...universal, ...ageBand].filter(
            (q) => isAskedInQuestionnaire(q) && isAnswerable(q) && !answeredIds.has(q.id),
          ),
        );
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
      .map((q) => ({
        q,
        merged: mergeAnswer(answers[q.id], freeTexts[q.id], otherTexts[q.id]),
      }))
      .filter((entry): entry is { q: Question; merged: Answer } =>
        isAnswered(entry.merged),
      )
      .map(({ q, merged }) => ({
        question_id: q.id,
        domain: q.domain,
        answer: merged,
        timestamp: now,
      }));

    // Every question skipped — nothing to save. Don't POST an empty batch (the backend
    // rejects it as a validation error, surfacing as a bogus "couldn't save" message
    // right after we promised skipping is fine, #20). Results shows the latest computed
    // profile if one exists; emptySubmit tells it that a 404 here means "answered
    // nothing yet", so it renders the not-enough-information state instead of bouncing
    // straight back to Question 1 like a silent reset (#53).
    if (responses.length === 0) {
      setSubmitting(false);
      navigation.replace('Results', { emptySubmit: true });
      return;
    }

    try {
      await submitIntakeResponses(childId, responses);
      // Issue #102: a Premium submission that included free text checks for AI-detected
      // confirmation follow-ups BEFORE Results renders, so a caregiver never watches a
      // result change under them after confirming one. Everyone else — guest, free tier,
      // or nothing typed this session — goes straight to Results, unchanged.
      if (canUseAiFeatures({ isGuest, tier }) && hasFreeTextAnswer(responses)) {
        navigation.replace('FollowUpCheck');
      } else {
        navigation.replace('Results');
      }
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

  // Every askable question already has an answer (#42) — possible when a caregiver
  // returns from gated results after answering everything (e.g. mostly "I'm not sure",
  // which counts as answered but not as scored evidence). "Question 1 of 0" or an
  // "All steps walked · you answered 0 of 0" review would read as broken; say what's
  // actually true instead.
  if (questions.length === 0) {
    return (
      <View style={styles.centered} testID="all-answered-state">
        <View style={styles.reviewIcon}>
          <Ionicons name="footsteps-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.reviewHeading}>Nothing new to ask right now</Text>
        <Text style={styles.allAnsweredBody}>
          You've already answered every question we have about {child.nickname} for now.
          Everything you shared is saved.
        </Text>
        <View style={styles.allAnsweredButton}>
          <PrimaryButton
            label="See what we noticed"
            onPress={() => navigation.replace('Results')}
            testID="all-answered-results-button"
          />
        </View>
      </View>
    );
  }

  const total = questions.length;
  const onReviewStep = index >= total;
  const question = onReviewStep ? null : questions[index];
  // One per-question truth drives both the counter and the stones, so they can never
  // disagree the way "You answered 0 of 33" under a fully green path did (#37).
  const answeredSteps = questions.map((q) =>
    isAnswered(mergeAnswer(answers[q.id], freeTexts[q.id], otherTexts[q.id])),
  );
  const answeredCount = answeredSteps.filter(Boolean).length;
  // A gentle lift at the path's midpoint — only worth marking on a longer walk.
  const isHalfway = !onReviewStep && total >= 8 && index === Math.floor(total / 2);

  // Manual navigation (Next / Skip / Back) cancels any pending auto-advance so a tap
  // followed quickly by Skip can never move two steps.
  const goForward = () => {
    clearAdvanceTimer();
    setIndex((i) => Math.min(i + 1, total));
  };
  const goBack = () => {
    clearAdvanceTimer();
    setIndex((i) => Math.max(i - 1, 0));
  };

  const handleAnswer = (q: Question, next: Answer) => {
    setAnswers((prev) => ({ ...prev, [q.id]: next }));
    // Unchecking "Other — type it" discards what was typed for it — stale text must
    // never ride into the submission after the option it belonged to is gone (#28).
    if (Array.isArray(next) && !next.includes(OTHER_OPTION_ID)) {
      setOtherTexts((prev) => {
        if (!(q.id in prev)) return prev;
        const rest = { ...prev };
        delete rest[q.id];
        return rest;
      });
    }
    // One tap = one step forward: single-select answers advance on their own — after a
    // short pause so the selection is seen to register. Multi-select and free text keep
    // collecting until "Next", and so do questions offering an "add anything else" box,
    // or auto-advance would yank the caregiver away before they could type. Re-tapping
    // a different option during the pause just restarts it.
    if (q.type !== 'chip_multi_select' && q.type !== 'text' && !q.allow_free_text) {
      clearAdvanceTimer();
      advanceTimer.current = setTimeout(goForward, AUTO_ADVANCE_DELAY_MS);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ABOUT {child.nickname.toUpperCase()}</Text>
        <SteppingStones total={total} currentIndex={index} answered={answeredSteps} />
        <Text style={styles.progressLabel}>
          {onReviewStep ? 'All steps walked' : `Question ${index + 1} of ${total}`}
        </Text>
      </View>

      {/* Fixed navigation bar — always the same spot above the question, whatever the
          card's height: Back on the left; on the right one forward button that reads
          "Skip" until the question is answered and becomes a filled "Next" once it is
          (skipping stays a first-class, guilt-free option — §4.1b "never a trap").
          Outside the card animation on purpose so it never moves. */}
      {question && (
        <View style={styles.topNav}>
          <Pressable
            onPress={goBack}
            disabled={index === 0}
            accessibilityRole="button"
            accessibilityLabel="Back to the previous question"
            style={[styles.navButton, index === 0 && styles.navButtonHidden]}
            testID="back-button"
          >
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
            <Text style={styles.navButtonText}>Back</Text>
          </Pressable>
          {isAnswered(
            mergeAnswer(
              answers[question.id],
              freeTexts[question.id],
              otherTexts[question.id],
            ),
          ) ? (
            <Pressable
              onPress={goForward}
              accessibilityRole="button"
              accessibilityLabel="Go to the next question"
              style={[styles.navButton, styles.navButtonPrimary]}
              testID="next-button"
            >
              <Text style={[styles.navButtonText, styles.navButtonPrimaryText]}>
                Next
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.card} />
            </Pressable>
          ) : (
            <Pressable
              onPress={goForward}
              accessibilityRole="button"
              accessibilityLabel="Skip this question"
              style={styles.navButton}
              testID="skip-button"
            >
              <Text style={styles.navButtonText}>Skip</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.ink} />
            </Pressable>
          )}
        </View>
      )}

      {isHalfway && (
        <View style={styles.encouragement} testID="halfway-encouragement">
          <Ionicons name="footsteps-outline" size={18} color={colors.accent} />
          <Text style={styles.encouragementText}>
            Halfway there — you're doing great. Pause any time; your answers wait for you.
          </Text>
        </View>
      )}

      {question && (
        <Animated.View
          style={{
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
        >
          <QuestionRenderer
            key={question.id}
            question={question}
            text={question.text}
            hint={question.hint}
            childName={child.nickname}
            value={answers[question.id]}
            onChange={(next) => handleAnswer(question, next)}
            freeText={freeTexts[question.id]}
            onFreeTextChange={(next) =>
              setFreeTexts((prev) => ({ ...prev, [question.id]: next }))
            }
            otherText={otherTexts[question.id]}
            onOtherTextChange={(next) =>
              setOtherTexts((prev) => ({ ...prev, [question.id]: next }))
            }
            canUseAiFeatures={canUseAiFeatures({ isGuest, tier })}
          />
        </Animated.View>
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
          {/* Honesty at the review step (issue #22): below the minimum-evidence floor the
              next screen will mostly say "not enough information yet" — set that
              expectation here so it never reads as a surprise or a reproach. Skipping
              stays guilt-free; answeredCount also counts unscored (profile/strengths)
              answers, so if anything this under-warns, never over-warns. */}
          {answeredCount < EVIDENCE_FLOORS.min_scored_answers_overall && (
            <Text style={styles.lowEvidenceNotice} testID="low-evidence-notice">
              That's only a little to go on so far, so the next screen may not have much
              to share yet. You can answer more whenever you're ready.
            </Text>
          )}

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
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  navButtonHidden: { opacity: 0 },
  navButtonText: { ...type.bodyStrong, color: colors.ink },
  navButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  navButtonPrimaryText: { color: colors.card },
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
  allAnsweredBody: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  allAnsweredButton: { marginTop: spacing.xl, alignSelf: 'stretch' },
  lowEvidenceNotice: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
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
