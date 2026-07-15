import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getChildren } from '../../api/index.js';
import { isAdmin, useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { AppWordmark } from '../../components/index.js';
import { colors, spacing } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * Routes based on resumed session state (product plan Screen 1). Issue #97: a logged-out
 * session goes to Login first, ahead of everything else — no valid access token means the
 * caregiver never lands on Consent Center or Child Profile Setup. Issue #99: "Continue as
 * guest" on Login is the other way past that gate — a guest session (isGuest) proceeds
 * exactly like a logged-in one from here on, just without an accessToken. Once past the
 * gate: no family yet -> Consent Center; a family and an already-active child -> Results.
 *
 * Issue #23: a logged-in session with a recovered family but no LOCAL childId (a fresh
 * device, or "answer again" from before multi-child support) might still have children
 * recorded server-side under that family — check before assuming this is a brand-new
 * family and sending the caregiver to create a duplicate child. Zero children (first time
 * ever, or any lookup failure) falls through to Child Profile Setup as before. A guest
 * session never persists a child server-side, so there's nothing to recover — it goes
 * straight to Child Profile Setup, unchanged.
 *
 * If the child has no computed results yet (questionnaire never submitted), the Results
 * screen forwards to the Questionnaire — safe now that the scoring engine dedupes
 * re-answered questions.
 *
 * Issue #125: an admin session sees AdminLanding's "app or admin console" choice before
 * any of the above, on every launch/resume — unless it's already been answered this trip
 * through Splash (AdminLandingScreen's "Continue to app" replaces back here with
 * `skipAdminChoice: true`, so choosing "app" doesn't bounce back to the choice a second
 * time on the very next Splash render).
 */
export function SplashScreen({ navigation, route }: Props) {
  const { isLoading, accessToken, isGuest, familyId, childId, role } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!accessToken && !isGuest) {
      navigation.replace('Login');
      return;
    }
    if (isAdmin({ isGuest, role }) && !route.params?.skipAdminChoice) {
      navigation.replace('AdminLanding');
      return;
    }
    if (!familyId) {
      navigation.replace('ConsentCenter');
      return;
    }
    if (childId) {
      navigation.replace('Results');
      return;
    }
    if (isGuest) {
      navigation.replace('ChildProfileSetup');
      return;
    }
    let cancelled = false;
    getChildren(familyId)
      .then((children) => {
        if (cancelled) return;
        navigation.replace(children.length > 0 ? 'ChildSwitcher' : 'ChildProfileSetup');
      })
      .catch(() => {
        if (!cancelled) navigation.replace('ChildProfileSetup');
      });
    return () => {
      cancelled = true;
    };
  }, [
    isLoading,
    accessToken,
    isGuest,
    role,
    familyId,
    childId,
    navigation,
    route.params?.skipAdminChoice,
  ]);

  return (
    <View style={styles.container}>
      <AppWordmark />
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
  spinner: {
    marginTop: spacing.lg,
  },
});
