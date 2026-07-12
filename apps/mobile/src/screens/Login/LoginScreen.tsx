import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { login } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { AppWordmark, PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

/**
 * Issue #97: gates the whole app behind a logged-in session. A successful login clears any
 * stale familyId/childId first — until a User is linked to the Family/Child it owns (out of
 * scope here, tracked in docs/clinical-review/content-gaps.md §6), carrying another
 * session's local IDs into a fresh login would silently show one account another's family
 * data or a broken questionnaire/results state. Then it stores the access_token and resets
 * the navigation stack back to Splash, which re-runs its own routing — this screen stays
 * unaware of what comes after it.
 *
 * Issue #99: "Continue as guest" is the other way past the gate — no account, so answers
 * run through the same on-device-only pipeline as declining data_storage consent (issue
 * #63) and AI-assisted analysis is unavailable (packages/scoring-engine untouched; see
 * canUseAiFeatures in session/SessionContext.tsx).
 */
export function LoginScreen({ navigation }: Props) {
  const { reset, setAccessToken, continueAsGuest } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(username.trim(), password);
      await reset();
      await setAccessToken(result.access_token, result.user.tier);
      navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't reach the server. Please check your connection and try again.",
      );
      setSubmitting(false);
    }
  };

  const handleContinueAsGuest = () => {
    continueAsGuest();
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppWordmark variant="inline" />

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Log in to continue where you left off.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Username"
            testID="login-username-input"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Password"
            testID="login-password-input"
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.submitButton}>
            <PrimaryButton
              testID="login-submit-button"
              label="Log in"
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
            />
          </View>
        </View>

        <Pressable
          onPress={() => navigation.navigate('Signup')}
          accessibilityRole="button"
          testID="login-go-to-signup"
        >
          <Text style={styles.linkText}>Don't have an account? Sign up</Text>
        </Pressable>

        <View style={styles.guestDivider}>
          <View style={styles.guestDividerLine} />
          <Text style={styles.guestDividerText}>or</Text>
          <View style={styles.guestDividerLine} />
        </View>

        <Pressable
          onPress={handleContinueAsGuest}
          accessibilityRole="button"
          testID="login-continue-as-guest"
        >
          <Text style={styles.guestText}>Continue as guest</Text>
        </Pressable>
        <Text style={styles.guestHint}>
          Answer now without an account. Nothing is saved, and AI-assisted analysis isn't
          available — sign up any time to keep your results and unlock more.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  heading: {
    ...type.title,
    color: colors.ink,
    marginTop: spacing.xxl,
    marginBottom: spacing.xs,
  },
  subheading: { ...type.body, color: colors.inkSoft, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...cardShadow,
  },
  label: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.background,
  },
  errorText: { ...type.body, color: colors.error, marginTop: spacing.lg },
  submitButton: { marginTop: spacing.xxl },
  linkText: {
    ...type.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  guestDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  guestDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  guestDividerText: {
    ...type.caption,
    color: colors.inkSoft,
    marginHorizontal: spacing.md,
  },
  guestText: {
    ...type.bodyStrong,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  guestHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
