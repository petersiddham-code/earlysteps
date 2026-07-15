import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { colors, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminLanding'>;

/**
 * Issue #125: the first screen an admin session sees after Splash, on every app
 * launch/resume — lets them choose the ordinary caregiver app or the Admin Console
 * instead of the console only being reachable once they've already navigated deep into
 * the app (the original v1 shipped it as a header button on ChildSwitcher, which stayed
 * hidden until a child existed). "Continue to app" replaces back to Splash with
 * `skipAdminChoice: true` so this screen doesn't reappear a second time on the very next
 * Splash render; the ChildSwitcher header button remains as a secondary way back into
 * the console later in the same session.
 */
export function AdminLandingScreen({ navigation }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>SIGNED IN AS ADMIN</Text>
      <Text style={styles.heading}>Where would you like to go?</Text>
      <View style={styles.actions}>
        <PrimaryButton
          label="Open admin console"
          onPress={() => navigation.navigate('AdminDashboard')}
          testID="admin-landing-open-console"
        />
        <PrimaryButton
          label="Continue to app"
          variant="quiet"
          onPress={() => navigation.replace('Splash', { skipAdminChoice: true })}
          testID="admin-landing-continue-to-app"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  heading: {
    ...type.title,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  actions: { gap: spacing.md },
});
