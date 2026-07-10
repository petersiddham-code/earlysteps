import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * Routes based on resumed session state (product plan Screen 1). Issue #97: a logged-out
 * session goes to Login first, ahead of everything else — no valid access token means the
 * caregiver never lands on Consent Center or Child Profile Setup. Issue #99: "Continue as
 * guest" on Login is the other way past that gate — a guest session (isGuest) proceeds
 * exactly like a logged-in one from here on, just without an accessToken. Once past the
 * gate: no family yet -> Consent Center; a family but no child -> Child Profile Setup; both
 * -> Results. If the child has no computed results yet (questionnaire never submitted), the
 * Results screen forwards to the Questionnaire — safe now that the scoring engine dedupes
 * re-answered questions.
 */
export function SplashScreen({ navigation }: Props) {
  const { isLoading, accessToken, isGuest, familyId, childId } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken && !isGuest) {
      navigation.replace('Login');
    } else if (!familyId) {
      navigation.replace('ConsentCenter');
    } else if (!childId) {
      navigation.replace('ChildProfileSetup');
    } else {
      navigation.replace('Results');
    }
  }, [isLoading, accessToken, isGuest, familyId, childId, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Ionicons name="footsteps-outline" size={34} color={colors.primary} />
      </View>
      <Text style={styles.title}>EarlySteps</Text>
      <ActivityIndicator style={styles.spinner} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  spinner: {
    marginTop: spacing.sm,
  },
});
