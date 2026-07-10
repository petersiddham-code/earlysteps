import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FollowUpAnswer, FollowUpSuggestion } from '@earlysteps/shared-types';
import { analyzeResponses, answerFollowUpSuggestion, getChild } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { FollowUpSuggestions, PrimaryButton } from '../../components/index.js';
import { colors, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowUpCheck'>;

/**
 * How long to wait for the analysis call before giving up and going straight to Results
 * (issue #102). Offline-first still applies here: a slow or unreachable LLM call can
 * never keep a caregiver from reaching their own results.
 */
export const FOLLOW_UP_CHECK_TIMEOUT_MS = 8000;

/**
 * Interim step between the Questionnaire and Results (issue #102): only reached by a
 * logged-in Premium submission that included free text. Checks for AI-detected
 * confirmation follow-ups and has the caregiver answer them here, before Results ever
 * renders — so a confirmed serious sign never changes a result already on screen.
 *
 * Never a hard block: the analysis call races an 8-second timeout, and a manual "See my
 * results now" way out is always available once suggestions are showing — skipping stays
 * guilt-free everywhere else in this app (§4.1b), and this screen is no exception.
 */
export function FollowUpCheckScreen({ navigation }: Props) {
  const { familyId, childId } = useSession();
  const [followUps, setFollowUps] = useState<FollowUpSuggestion[] | null>(null);
  const [childName, setChildName] = useState('your child');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) {
      navigation.replace('Results');
      return;
    }
    let cancelled = false;

    if (familyId) {
      getChild(familyId, childId)
        .then((child) => {
          if (!cancelled) setChildName(child.nickname);
        })
        .catch(() => {});
    }

    const timeout = new Promise<FollowUpSuggestion[]>((resolve) => {
      setTimeout(() => resolve([]), FOLLOW_UP_CHECK_TIMEOUT_MS);
    });
    Promise.race([analyzeResponses(childId), timeout])
      .then((suggestions) => {
        if (cancelled) return;
        if (suggestions.length === 0) {
          navigation.replace('Results');
        } else {
          setFollowUps(suggestions);
        }
      })
      .catch(() => {
        if (!cancelled) navigation.replace('Results');
      });

    return () => {
      cancelled = true;
    };
    // Deliberately childId-only: familyId and navigation don't change mid-check.
  }, [childId]);

  const handleAnswer = async (suggestion: FollowUpSuggestion, answer: FollowUpAnswer) => {
    if (!childId || answeringId !== null) return;
    setAnsweringId(suggestion.id);
    setError(null);
    try {
      await answerFollowUpSuggestion(childId, suggestion.id, answer);
      setFollowUps((prev) => {
        const next = (prev ?? []).filter((s) => s.id !== suggestion.id);
        if (next.length === 0) navigation.replace('Results');
        return next;
      });
    } catch {
      setError("We couldn't save that answer. Please try again.");
    } finally {
      setAnsweringId(null);
    }
  };

  if (followUps === null) {
    return (
      <View style={styles.centered} testID="follow-up-check-loading">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Looking at what you shared…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FollowUpSuggestions
        suggestions={followUps}
        childName={childName}
        answeringId={answeringId}
        error={error}
        onAnswer={handleAnswer}
      />
      <View style={styles.skipButton}>
        <PrimaryButton
          label="See my results now"
          variant="quiet"
          onPress={() => navigation.replace('Results')}
          testID="skip-follow-up-check"
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
  loadingText: {
    ...type.body,
    color: colors.inkSoft,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  skipButton: { alignSelf: 'stretch' },
});
