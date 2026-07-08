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
import { allQuestions, getFollowUp, RESULT_COPY } from '@earlysteps/content';
import {
  DOMAIN_DISPLAY_NAMES,
  FOLLOW_UP_ANSWER_OPTIONS,
  isFreeTextAnswer,
  stripFreeTextPrefix,
  type FollowUpAnswer,
  type FollowUpSuggestion,
  type IntakeResponse,
  type ResultsView,
  type SignLevel,
  type SignLevelLabel,
} from '@earlysteps/shared-types';
import {
  analyzeResponses,
  answerFollowUpSuggestion,
  getChild,
  getIntakeResponses,
  getResults,
} from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  PersonalizedText,
  PrimaryButton,
  ScreeningDisclaimer,
  StrengthsFirstList,
  TrafficLightBar,
  RedFlagBanner,
  CrisisSupportCard,
} from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

/**
 * Reconstructs the caregiver's own strengths/interests answers (universal questions U9/U10,
 * domain: "strengths") into plain text, by looking up the option labels they selected. This
 * is not invented — it's their own words reflected back — which is why it's safe to show
 * without an LLM summarization step (that's product plan §9.3, still out of scope).
 */
function deriveStrengths(responses: IntakeResponse[]): string[] {
  const questions = allQuestions();
  const labels: string[] = [];
  for (const response of responses) {
    if (response.domain !== 'strengths') continue;
    const question = questions.find((q) => q.id === response.question_id);
    if (!question) continue;
    const selectedIds = Array.isArray(response.answer)
      ? response.answer
      : [String(response.answer)];
    for (const id of selectedIds) {
      // A caregiver-typed strength (free_text: entry) is their own words — show it
      // verbatim, same as a selected option label.
      if (isFreeTextAnswer(id)) {
        labels.push(stripFreeTextPrefix(id));
        continue;
      }
      const option = question.options.find((o) => o.id === id);
      if (option) labels.push(option.label);
    }
  }
  return labels;
}

/**
 * Deterministic placeholder for "top support needs" (product plan §9.3 eventually generates
 * this narrative via LLM — out of scope here): any domain that scored above "Low signs
 * observed", named with the approved respectful domain vocabulary. Not narrative, just a
 * direct, data-grounded list — never invents a claim beyond what was computed.
 */
function deriveNeeds(results: ResultsView): string[] {
  // Only domains with a real (evidence-sufficient) level can be named as support needs —
  // a "not enough information yet" domain is a gap, not a need (issue #22).
  return results.domains
    .filter((d) => d.status === 'scored' && d.label !== 'Low signs observed')
    .map((d) => DOMAIN_DISPLAY_NAMES[d.domain]);
}

/**
 * Provenance (issue #22): results must say what they rest on — after an all-skipped retake
 * the previous profile is still shown, and without this line it reads as if results
 * materialized from zero input.
 */
function provenanceLine(results: ResultsView): string {
  const noun = results.basedOnAnswers === 1 ? 'answer' : 'answers';
  const updated = new Date(results.computedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return `Based on ${results.basedOnAnswers} ${noun} · last updated ${updated}`;
}

/** <TrafficLightBar/> takes the internal SignLevel key, the API returns the display label. */
const LABEL_TO_SIGN_LEVEL: Record<SignLevelLabel, SignLevel> = {
  'Low signs observed': 'low',
  'Some signs observed': 'some',
  'Many signs observed': 'many',
};

/**
 * Closed-choice answers for a confirmation follow-up, labelled from the content
 * package (single source of truth — never hardcoded here, CLAUDE.md §5). Anything
 * off the yes/no/not_sure vocabulary is dropped defensively.
 */
function followUpOptions(
  suggestion: FollowUpSuggestion,
): { id: FollowUpAnswer; label: string }[] {
  const options = getFollowUp(suggestion.follow_up_id)?.options ?? [];
  return options.filter((option): option is { id: FollowUpAnswer; label: string } =>
    (FOLLOW_UP_ANSWER_OPTIONS as readonly string[]).includes(option.id),
  );
}

export function ResultsScreen({ navigation }: Props) {
  const { familyId, childId, clearChildId } = useSession();
  const [results, setResults] = useState<ResultsView | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [childName, setChildName] = useState('your child');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setError(null);
    Promise.all([getResults(childId), getIntakeResponses(childId)])
      .then(([resultsView, responses]) => {
        if (cancelled) return;
        setResults(resultsView);
        setStrengths(deriveStrengths(responses));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // No computed results for this child yet — the questionnaire was never
          // submitted (e.g. the app was closed partway through onboarding). Send them
          // there instead of stranding them on an error that can never resolve.
          navigation.replace('Questionnaire');
          return;
        }
        setError("We couldn't load your results. Please try again.");
      });

    // Best-effort extras (issue #26): ask the server to analyze any typed answers and
    // return pending confirmation follow-ups. Results NEVER wait on this — any failure
    // (offline, no AI consent → 403, analysis unavailable) just means no follow-up
    // card. The deterministic results above are complete without it.
    analyzeResponses(childId)
      .then((suggestions) => {
        if (!cancelled) setFollowUps(suggestions);
      })
      .catch(() => {});
    if (familyId) {
      getChild(familyId, childId)
        .then((child) => {
          if (!cancelled) setChildName(child.nickname);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [familyId, childId, navigation, attempt]);

  /**
   * The caregiver's structured answer is submitted as a NORMAL intake response — the
   * deterministic engine recomputes and the returned view replaces what's on screen,
   * so a confirmed serious sign surfaces immediately (as a red flag computed by the
   * rules, never by the AI).
   */
  const handleFollowUpAnswer = async (
    suggestion: FollowUpSuggestion,
    answer: FollowUpAnswer,
  ) => {
    if (!childId || answeringId !== null) return;
    setAnsweringId(suggestion.id);
    setFollowUpError(null);
    try {
      const view = await answerFollowUpSuggestion(childId, suggestion.id, answer);
      setResults(view);
      setFollowUps((prev) => prev.filter((s) => s.id !== suggestion.id));
    } catch {
      setFollowUpError("We couldn't save that answer. Please try again.");
    } finally {
      setAnsweringId(null);
    }
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!results) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const needs = deriveNeeds(results);
  // "Answer more questions" belongs on any view the minimum-evidence gate touched (#42):
  // a withheld recommendation OR any gated domain — the copy asks for more answers, so a
  // path to give them must exist. Red-flag views can be gated too; more answers still help.
  const isGated =
    results.recommendationTier === null ||
    results.domains.some((d) => d.status === 'insufficient_evidence');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Whose results these are (#41) — same eyebrow pattern as the questionnaire header.
          Falls back to "ABOUT YOUR CHILD" if the nickname fetch fails. */}
      <Text style={styles.eyebrow}>ABOUT {childName.toUpperCase()}</Text>
      <Text style={styles.heading}>Here's what we noticed</Text>
      <Text style={styles.provenance} testID="provenance-line">
        {provenanceLine(results)}
      </Text>
      <ScreeningDisclaimer />

      {/* One-tap crisis resources (issue #50, product plan §10 rule 10): when a
          self-injury or safety flag is present this must be immediately visible — above
          the fold, before anything the caregiver has to scroll for. Non-urgent flags
          (e.g. loss of skills) don't render this; they keep the calmer RedFlagBanner
          below, so the two urgency levels are visually distinct. */}
      <CrisisSupportCard redFlagTypes={results.redFlagTypes} />

      {/* Strengths stay first — enforced by the component, honoured by the layout.
          With nothing on either side (everything skipped, #32) the card disappears —
          two bare headings read as a broken screen, not as honesty. */}
      {(strengths.length > 0 || needs.length > 0) && (
        <View style={styles.card}>
          <StrengthsFirstList strengths={strengths} needs={needs} />
        </View>
      )}

      {/* No domains at all (0 scored answers, #32): drop the card rather than render an
          empty white box — the recommendation card below says "not enough information". */}
      {results.domains.length > 0 && (
        <View style={styles.card}>
          {results.domains.map((domain) =>
            // Minimum-evidence gate (issue #22): a gated domain has NO label/confidence on
            // the wire — it renders as "not enough information yet", never a traffic light.
            domain.status === 'scored' ? (
              <TrafficLightBar
                key={domain.domain}
                domain={domain.domain}
                level={LABEL_TO_SIGN_LEVEL[domain.label]}
                confidence={domain.confidence}
              />
            ) : (
              <TrafficLightBar
                key={domain.domain}
                domain={domain.domain}
                level="insufficient_evidence"
              />
            ),
          )}
          {results.domains.some((d) => d.status === 'insufficient_evidence') && (
            <Text style={styles.insufficientDetail} testID="insufficient-domain-detail">
              {RESULT_COPY.insufficient_evidence.domain_detail}
            </Text>
          )}
        </View>
      )}

      <RedFlagBanner redFlagTypes={results.redFlagTypes} />

      <View style={styles.card}>
        {results.supportLevel && (
          <Text style={styles.supportLevelText}>
            {results.supportLevel.term} ({results.supportLevel.confidence} confidence)
          </Text>
        )}
        {/* A null tier means "not enough information yet" AND no red flag (flags always
            force a tier — they're exempt from the evidence gate). Say so honestly instead
            of implying "we checked, support can begin now" off a couple of answers. The
            approved gate label heads the card so the empty state reads as a state, not a
            glitch (#32). */}
        {results.recommendationTier ? (
          <Text style={styles.recommendationText}>{results.recommendationTier}</Text>
        ) : (
          <>
            <Text style={styles.supportLevelText} testID="insufficient-overall-label">
              {RESULT_COPY.insufficient_evidence.label}
            </Text>
            {/* What the gate MEANS (#42) — a caregiver reading "not enough information"
                deserves to know it's a statement about the answer count, never about
                their child. */}
            <Text
              style={styles.recommendationText}
              testID="insufficient-overall-explanation"
            >
              {RESULT_COPY.insufficient_evidence.explanation}
            </Text>
            <Text style={styles.recommendationText} testID="insufficient-overall-detail">
              {RESULT_COPY.insufficient_evidence.overall_detail}
            </Text>
          </>
        )}
        {/* The way OUT of the gated state (#42): back into the questionnaire for the SAME
            child — only unanswered questions are asked. Deliberately not the destructive
            "Start a new set of questions" below, which forgets the child. */}
        {isGated && (
          <View style={styles.answerMoreButton}>
            <PrimaryButton
              label="Answer more questions"
              onPress={() => navigation.replace('Questionnaire')}
              testID="answer-more-button"
            />
          </View>
        )}
      </View>

      {/* Issue #26: confirmation follow-ups for things the caregiver typed in their
          own words. The AI only proposed showing these content-authored questions —
          the caregiver's structured answer goes through the normal deterministic
          pipeline, which alone decides scores and red flags. Purely additive: when
          there are no suggestions (or AI consent is off), this card simply isn't. */}
      {followUps.length > 0 && (
        <View style={styles.card} testID="follow-up-card">
          <Text style={styles.followUpHeading}>About something you wrote</Text>
          <Text style={styles.followUpIntro}>
            Your own words matter. To be sure we understood them, here's a quick question
            — your answer is what counts, and "I'm not sure" is always fine.
          </Text>
          {followUps.map((suggestion) => (
            <View
              key={suggestion.id}
              style={styles.followUpItem}
              testID={`follow-up-${suggestion.follow_up_id}`}
            >
              <Text style={styles.followUpQuote}>"{suggestion.source_quote}"</Text>
              <PersonalizedText
                template={suggestion.text}
                name={childName}
                style={styles.followUpQuestion}
              />
              <PersonalizedText
                template={suggestion.hint}
                name={childName}
                style={styles.followUpHint}
              />
              <View style={styles.followUpOptions}>
                {followUpOptions(suggestion).map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleFollowUpAnswer(suggestion, option.id)}
                    disabled={answeringId !== null}
                    accessibilityRole="button"
                    style={[
                      styles.followUpOption,
                      answeringId !== null && styles.followUpOptionDisabled,
                    ]}
                    testID={`follow-up-${suggestion.follow_up_id}-${option.id}`}
                  >
                    <Text style={styles.followUpOptionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {followUpError && <Text style={styles.errorText}>{followUpError}</Text>}
        </View>
      )}

      {/* Issue #20: results must never be a dead end. Splash replace()s straight here for
          a returning session, so without these the caregiver has no path back into the
          app's flows. Starting a new set of questions forgets the child but keeps the
          family (consent stays granted) and begins at the child's details — the app holds
          one child at a time, so this is also how a different child gets screened until
          multi-child support lands (#23). The old profile stays stored server-side for
          when accounts/login exist; it just stops being viewable on this device, which
          the hint says plainly. replace, not navigate — no stale Results underneath. */}
      <View style={styles.actions}>
        <Text style={styles.actionsHint}>
          Starting a new set of questions begins fresh with a child's details. These
          results won't be shown in the app afterwards, so note down anything you want to
          keep.
        </Text>
        <PrimaryButton
          label="Start a new set of questions"
          onPress={async () => {
            await clearChildId();
            navigation.replace('ChildProfileSetup');
          }}
          testID="new-questions-button"
        />
        <PrimaryButton
          label="Review my permissions"
          variant="quiet"
          onPress={() => navigation.navigate('ConsentCenter')}
          testID="permissions-button"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xxl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  heading: { ...type.title, color: colors.ink },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  provenance: { ...type.caption, color: colors.inkSoft },
  insufficientDetail: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  errorText: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  retryText: { ...type.bodyStrong, color: colors.primary, marginTop: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...cardShadow,
  },
  supportLevelText: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  recommendationText: { ...type.body, color: colors.inkSoft, marginBottom: spacing.xs },
  answerMoreButton: { marginTop: spacing.md },
  followUpHeading: { ...type.title, color: colors.ink, marginBottom: spacing.xs },
  followUpIntro: { ...type.caption, color: colors.inkSoft, marginBottom: spacing.lg },
  followUpItem: { marginBottom: spacing.md },
  followUpQuote: {
    ...type.body,
    color: colors.inkSoft,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  followUpQuestion: { ...type.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  followUpHint: { ...type.caption, color: colors.inkSoft, marginBottom: spacing.md },
  followUpOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  followUpOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  followUpOptionDisabled: { opacity: 0.5 },
  followUpOptionText: { ...type.bodyStrong, color: colors.ink },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  actionsHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
