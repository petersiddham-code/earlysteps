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
import { allQuestions, RESULT_COPY } from '@earlysteps/content';
import {
  DOMAIN_DISPLAY_NAMES,
  isFreeTextAnswer,
  stripFreeTextPrefix,
  type AiResultsSummary,
  type ComparisonResult,
  type Domain,
  type FollowUpAnswer,
  type FollowUpSuggestion,
  type IntakeResponse,
  type ResultsView,
  type SignLevel,
  type SignLevelLabel,
} from '@earlysteps/shared-types';
import {
  answerFollowUpSuggestion,
  getAiResultsSummary,
  getChild,
  getComparisonResult,
  getIntakeResponses,
  getFollowUpSuggestions,
  getResults,
} from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { canUseAiFeatures, useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  AIAssessmentCard,
  ComparisonCard,
  FollowUpSuggestions,
  PrimaryButton,
  ScreeningDisclaimer,
  StrengthsFirstList,
  TrafficLightBar,
  RedFlagBanner,
  CrisisSupportCard,
  DomainResourcesCard,
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
 * Domains with a real (evidence-sufficient) level above "Low signs observed" — a "not enough
 * information yet" domain is a gap, not a need (issue #22). Shared by the support-needs list
 * and the resource links (issue #71), which are both keyed off the same set.
 */
function needsDomains(results: ResultsView): Domain[] {
  return results.domains
    .filter((d) => d.status === 'scored' && d.label !== 'Low signs observed')
    .map((d) => d.domain);
}

/**
 * Deterministic placeholder for "top support needs" (product plan §9.3 eventually generates
 * this narrative via LLM — out of scope here): named with the approved respectful domain
 * vocabulary. Not narrative, just a direct, data-grounded list — never invents a claim beyond
 * what was computed.
 */
function deriveNeeds(results: ResultsView): string[] {
  return needsDomains(results).map((domain) => DOMAIN_DISPLAY_NAMES[domain]);
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

export function ResultsScreen({ navigation, route }: Props) {
  const { familyId, childId, isGuest, tier, clearChildId } = useSession();
  const [results, setResults] = useState<ResultsView | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[]>([]);
  const [aiSummary, setAiSummary] = useState<AiResultsSummary | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [childName, setChildName] = useState('your child');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [noResultsYet, setNoResultsYet] = useState(false);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setError(null);
    setNoResultsYet(false);
    Promise.all([getResults(childId), getIntakeResponses(childId)])
      .then(([resultsView, responses]) => {
        if (cancelled) return;
        setResults(resultsView);
        setStrengths(deriveStrengths(responses));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          // No computed results for this child yet. Two very different reasons (#53):
          // the caregiver just finished the questionnaire having skipped everything
          // (emptySubmit) — bouncing them to Question 1 reads as a silent session
          // reset, so show the honest "not enough information yet" state instead —
          // versus a cold resume where the questionnaire was never submitted (app
          // closed mid-onboarding), where going straight there is the right move.
          if (route.params?.emptySubmit) {
            setNoResultsYet(true);
            return;
          }
          navigation.replace('Questionnaire');
          return;
        }
        setError("We couldn't load your results. Please try again.");
      });

    // Safety net, not a trigger (issue #102): FollowUpCheckScreen is what actually asks
    // the server to analyze typed answers, before this screen ever renders, for a
    // Premium submission that included free text. This just reads whatever's still
    // pending — e.g. the 8-second timeout there elapsed before analysis finished — so a
    // slow result still surfaces here rather than being lost. Never calls the LLM itself,
    // never blocks: any failure (offline, no AI consent → 403) just means no card. Issue
    // #99: a guest or free-tier session never reaches the LLM stage at all.
    if (canUseAiFeatures({ isGuest, tier })) {
      getFollowUpSuggestions(childId)
        .then((suggestions) => {
          if (!cancelled) setFollowUps(suggestions);
        })
        .catch(() => {});

      // Issue #104: kicked off as soon as Results loads, not when the collapsible AI
      // section is expanded, so the narrative is usually already there by the time the
      // caregiver taps it open. A slower background fetch on top of the deterministic
      // content already on screen — any failure (offline, no ai_analysis consent -> 403,
      // malformed/unsafe model output) just means the card never appears.
      //
      // The Comparison Section (CLAUDE.md §13/§14, dual-assessment update) is chained
      // off the summary fetch rather than fired in parallel: it needs Assessment B's
      // output to exist first (the backend recomputes it from the same cached/just-
      // generated summary), and sequencing this way means a Results visit never causes
      // two independent LLM-adjacent calls to race each other for no reason. No
      // comparison is fetched when there's no summary to compare — same fail-closed
      // "no section" contract as everything else here.
      getAiResultsSummary(childId)
        .then((summary) => {
          if (cancelled) return;
          setAiSummary(summary);
          if (!summary) return;
          return getComparisonResult(childId).then((result) => {
            if (!cancelled) setComparison(result);
          });
        })
        .catch(() => {});
    }
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
  }, [familyId, childId, isGuest, tier, navigation, route.params, attempt]);

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

  // Answered nothing, no prior results (#53): the same honest "not enough information
  // yet" state the 1-answer case gets — with the disclaimer (§2 rule 5) and every path
  // forward — instead of the silent bounce back to Question 1. Reuses the approved
  // insufficient-evidence copy verbatim; no new clinical content.
  if (noResultsYet) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ABOUT {childName.toUpperCase()}</Text>
        <Text style={styles.heading}>Here's what we noticed</Text>
        <ScreeningDisclaimer />
        <View style={styles.card} testID="empty-results-state">
          <Text style={styles.supportLevelText} testID="insufficient-overall-label">
            {RESULT_COPY.insufficient_evidence.label}
          </Text>
          <Text style={styles.recommendationText}>
            {RESULT_COPY.insufficient_evidence.explanation}
          </Text>
          <Text style={styles.recommendationText}>
            {RESULT_COPY.insufficient_evidence.overall_detail}
          </Text>
          <View style={styles.answerMoreButton}>
            <PrimaryButton
              label="Answer more questions"
              onPress={() => navigation.replace('Questionnaire')}
              testID="answer-more-button"
            />
          </View>
        </View>
        <View style={styles.actions}>
          <Text style={styles.actionsHint}>
            Starting a new set of questions begins fresh with a child's details. These
            results won't be shown in the app afterwards, so note down anything you want
            to keep.
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

      {/* Section A — Assessment A, the deterministic screening engine (CLAUDE.md §14).
          Everything below through the follow-up safety net is this section: a single,
          visually and structurally distinct region (testID-verified) that never merges
          with Assessment B or the Comparison Section below it. This is exactly what the
          screen already rendered before the dual-assessment update — only the wrapping
          is new. */}
      <View style={styles.section} testID="section-a-deterministic">
        {/* Section A's own heading (issue #112): Sections B and Comparison below already
            title themselves (AIAssessmentCard/ComparisonCard render their own card_heading)
            — Section A didn't, so the three regions read asymmetrically. This closes that
            gap with the same visual language (icon + bodyStrong heading), making which
            section is the official deterministic result versus an AI reflection obvious at
            a glance, not just structurally (CLAUDE.md §14). */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionHeading} testID="section-a-heading">
            {RESULT_COPY.card_heading}
          </Text>
        </View>

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

        {/* Trusted resource links alongside support needs (issue #71): curated, static content
          keyed off the same needs domains as the list above — never LLM-selected (that's a
          deliberate future paid-tier feature per the issue, out of scope here). Renders
          nothing on its own if there are no needs domains or none ship a resource yet. */}
        <DomainResourcesCard domains={needsDomains(results)} />

        {/* No domains at all (0 scored answers, #32): drop the card rather than render an
          empty white box — the recommendation card below says "not enough information". */}
        {results.domains.length > 0 && (
          <View style={styles.card}>
            {results.domains.map((domain, i) => (
              // Hairline divider between rows (not after the last) — issue #112, a compact
              // summary band instead of a plain stacked list. Purely visual: the row content
              // itself is unchanged.
              <View
                key={domain.domain}
                style={i < results.domains.length - 1 && styles.domainRowDivider}
              >
                {domain.status === 'scored' ? (
                  // Minimum-evidence gate (issue #22): a gated domain has NO label/confidence
                  // on the wire — it renders as "not enough information yet", never a traffic
                  // light.
                  <TrafficLightBar
                    domain={domain.domain}
                    level={LABEL_TO_SIGN_LEVEL[domain.label]}
                    confidence={domain.confidence}
                  />
                ) : (
                  <TrafficLightBar domain={domain.domain} level="insufficient_evidence" />
                )}
              </View>
            ))}
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
            <>
              <Text style={styles.recommendationText}>{results.recommendationTier}</Text>
              {/* Issue #64: a recommendation with no confidence beside it can overstate
                certainty — this always travels 1:1 with recommendationTier (never
                rendered without it). */}
              {results.recommendationConfidence && (
                <Text
                  style={styles.recommendationConfidenceText}
                  testID="recommendation-confidence"
                >
                  Confidence: {results.recommendationConfidence}
                </Text>
              )}
              {/* Issue #70: a red flag forces this confidence to "high" regardless of how
                sparse the domain evidence is (by design — CLAUDE.md §2 rule 8, a red flag
                is a direct answer, not an average) — which can otherwise read as
                contradicting a lower confidence shown next to a domain above. Only shown
                in that one case; the non-red-flag path already borrows the domain
                estimate's own confidence, so there's nothing to reconcile there. */}
              {results.redFlagTypes.length > 0 && (
                <Text
                  style={styles.recommendationConfidenceNote}
                  testID="red-flag-confidence-note"
                >
                  {RESULT_COPY.red_flag_confidence_note}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.supportLevelText} testID="insufficient-overall-label">
                {RESULT_COPY.insufficient_evidence.label}
              </Text>
              {/* Issue #64: explicit rather than implied — too little evidence to
                recommend anything IS a low-confidence state, said plainly. */}
              <Text
                style={styles.recommendationConfidenceText}
                testID="insufficient-overall-confidence"
              >
                Confidence: low
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
              <Text
                style={styles.recommendationText}
                testID="insufficient-overall-detail"
              >
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

        {/* Issue #26: a safety net for any confirmation follow-up still pending (issue
            #102 moved the normal path to FollowUpCheckScreen, before this screen ever
            renders). The AI only proposed showing these content-authored questions — the
            caregiver's structured answer goes through the normal deterministic pipeline,
            which alone decides scores and red flags. Purely additive: nothing pending (or
            AI consent is off) means this card simply isn't. */}
        <FollowUpSuggestions
          suggestions={followUps}
          childName={childName}
          answeringId={answeringId}
          error={followUpError}
          onAnswer={handleFollowUpAnswer}
        />
      </View>

      {/* Section B — Assessment B, the independent AI Assessment Engine (CLAUDE.md §13/§14):
          a second, visually and structurally distinct region, never merged with Section A
          above. Wrapped on `aiSummary` (not just left to AIAssessmentCard's own null
          return) so the section is entirely absent from the tree — not an empty View —
          when there's nothing to show (fail closed, CLAUDE.md §8). */}
      {aiSummary && (
        <View testID="section-b-ai-assessment">
          <AIAssessmentCard summary={aiSummary} />
        </View>
      )}

      {/* Comparison Section (CLAUDE.md §13/§14, rule 14 §2): agreement / partial agreement /
          disagreement between Section A and Section B, computed as a third, standalone
          step AFTER both have independently produced their own output — never merged,
          averaged, or reconciled into either. Absent whenever there's no Assessment B
          narrative to compare against (no summary means no comparison either). */}
      {comparison && (
        <View testID="section-comparison">
          <ComparisonCard comparison={comparison} />
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
  // Section A's own children need the same inter-card gap the ScrollView's
  // contentContainer applies to its direct children (now including this wrapper).
  section: { gap: spacing.lg },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionHeading: { ...type.bodyStrong, color: colors.ink },
  domainRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
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
  recommendationConfidenceText: {
    ...type.caption,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  recommendationConfidenceNote: {
    ...type.caption,
    color: colors.inkSoft,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  answerMoreButton: { marginTop: spacing.md },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  actionsHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
