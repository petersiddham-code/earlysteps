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
import { allQuestions } from '@earlysteps/content';
import {
  DOMAIN_DISPLAY_NAMES,
  isFreeTextAnswer,
  stripFreeTextPrefix,
  type IntakeResponse,
  type ResultsView,
  type SignLevel,
  type SignLevelLabel,
} from '@earlysteps/shared-types';
import { getIntakeResponses, getResults } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  ScreeningDisclaimer,
  StrengthsFirstList,
  TrafficLightBar,
  RedFlagBanner,
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
  return results.domains
    .filter((d) => d.label !== 'Low signs observed')
    .map((d) => DOMAIN_DISPLAY_NAMES[d.domain]);
}

/** <TrafficLightBar/> takes the internal SignLevel key, the API returns the display label. */
const LABEL_TO_SIGN_LEVEL: Record<SignLevelLabel, SignLevel> = {
  'Low signs observed': 'low',
  'Some signs observed': 'some',
  'Many signs observed': 'many',
};

export function ResultsScreen({ navigation }: Props) {
  const { childId } = useSession();
  const [results, setResults] = useState<ResultsView | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
    return () => {
      cancelled = true;
    };
  }, [childId, navigation, attempt]);

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Here's what we noticed</Text>
      <ScreeningDisclaimer />

      {/* Strengths stay first — enforced by the component, honoured by the layout. */}
      <View style={styles.card}>
        <StrengthsFirstList strengths={strengths} needs={deriveNeeds(results)} />
      </View>

      <View style={styles.card}>
        {results.domains.map((domain) => (
          <TrafficLightBar
            key={domain.domain}
            domain={domain.domain}
            level={LABEL_TO_SIGN_LEVEL[domain.label]}
            confidence={domain.confidence}
          />
        ))}
      </View>

      <RedFlagBanner redFlagTypes={results.redFlagTypes} />

      <View style={styles.card}>
        {results.supportLevel && (
          <Text style={styles.supportLevelText}>
            {results.supportLevel.term} ({results.supportLevel.confidence} confidence)
          </Text>
        )}
        <Text style={styles.recommendationText}>{results.recommendationTier}</Text>
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
  recommendationText: { ...type.body, color: colors.inkSoft },
});
