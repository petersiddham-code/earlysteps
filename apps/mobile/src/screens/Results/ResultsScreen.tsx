import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { allQuestions } from '@earlysteps/content';
import {
  DOMAIN_DISPLAY_NAMES,
  type IntakeResponse,
  type ResultsView,
  type SignLevel,
  type SignLevelLabel,
} from '@earlysteps/shared-types';
import { getIntakeResponses, getResults } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import {
  ScreeningDisclaimer,
  StrengthsFirstList,
  TrafficLightBar,
  RedFlagBanner,
} from '../../components/index.js';

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

export function ResultsScreen(_props: Props) {
  const { childId } = useSession();
  const [results, setResults] = useState<ResultsView | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;
    Promise.all([getResults(childId), getIntakeResponses(childId)])
      .then(([resultsView, responses]) => {
        setResults(resultsView);
        setStrengths(deriveStrengths(responses));
      })
      .catch(() => setError("We couldn't load your results. Please try again."));
  }, [childId]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!results) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Here's what we noticed</Text>
      <ScreeningDisclaimer />

      <StrengthsFirstList strengths={strengths} needs={deriveNeeds(results)} />

      <View style={styles.section}>
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

      <View style={styles.section}>
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
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1F2933', marginBottom: 16 },
  errorText: { fontSize: 15, color: '#5A6672', textAlign: 'center' },
  section: { marginVertical: 12 },
  supportLevelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2933',
    marginBottom: 4,
  },
  recommendationText: { fontSize: 14, color: '#3A4A5A' },
});
