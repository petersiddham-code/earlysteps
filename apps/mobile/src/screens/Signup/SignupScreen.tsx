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
import { register } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

/**
 * Issue #97: gates the whole app behind a logged-in session. A successful signup stores the
 * access_token and resets the navigation stack back to Splash, which re-runs its own
 * routing (family/child presence) — this screen stays unaware of what comes after it.
 */
export function SignupScreen({ navigation }: Props) {
  const { setAccessToken } = useSession();
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
      const result = await register(username.trim(), password);
      await setAccessToken(result.access_token);
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

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.subheading}>
          One account keeps your family's progress safe across visits.
        </Text>

        <Text style={styles.label}>Username</Text>
        <Text style={styles.hint}>
          At least 3 characters — letters, numbers, dots, underscores, or hyphens.
        </Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Username"
          testID="signup-username-input"
        />

        <Text style={styles.label}>Password</Text>
        <Text style={styles.hint}>At least 8 characters.</Text>
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
          testID="signup-password-input"
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.submitButton}>
          <PrimaryButton
            testID="signup-submit-button"
            label="Sign up"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </View>

        <Pressable
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
          testID="signup-go-to-login"
        >
          <Text style={styles.linkText}>Already have an account? Log in</Text>
        </Pressable>
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
  heading: { ...type.title, color: colors.ink, marginBottom: spacing.xs },
  subheading: { ...type.body, color: colors.inkSoft, marginBottom: spacing.xl },
  label: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  hint: { ...type.caption, color: colors.inkSoft, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  errorText: { ...type.body, color: colors.error, marginTop: spacing.lg },
  submitButton: { marginTop: spacing.xxl },
  linkText: {
    ...type.body,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
