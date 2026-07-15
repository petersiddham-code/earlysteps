import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  USER_ROLES,
  USER_TIERS,
  type UserRole,
  type UserTier,
} from '@earlysteps/shared-types';
import { ApiError } from '../../api/client.js';
import { updateAdminAccount } from '../../api/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminAccountEdit'>;

/**
 * Issue #131: direct (non-draft) editor for one account's username/tier/role. Unlike
 * content editing (issue #127), account/operational metadata isn't clinical content
 * (CLAUDE.md §9), so an admin's change here takes effect immediately — no draft, no
 * clinical sign-off. The server (AdminService.updateAccount) is still the source of truth
 * for the two guardrails this screen can't fully know on its own: a username collision,
 * and self-demotion — this screen just surfaces whatever it rejects with.
 */
export function AdminAccountEditScreen({ navigation, route }: Props) {
  const { account } = route.params;
  const [username, setUsername] = useState(account.username);
  const [tier, setTier] = useState<UserTier>(account.tier);
  const [role, setRole] = useState<UserRole>(account.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await updateAdminAccount(account.id, { username: username.trim(), tier, role });
      navigation.goBack();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't save these changes. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="admin-account-edit-screen"
    >
      <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
      <Text style={styles.heading}>Edit account</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        testID="admin-account-edit-username"
      />

      <Text style={styles.label}>Tier</Text>
      <View style={styles.chipRow}>
        {USER_TIERS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setTier(option)}
            style={[styles.chip, tier === option && styles.chipSelected]}
            testID={`admin-account-edit-tier-${option}`}
          >
            <Text style={[styles.chipLabel, tier === option && styles.chipLabelSelected]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Role</Text>
      <View style={styles.chipRow}>
        {USER_ROLES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setRole(option)}
            style={[styles.chip, role === option && styles.chipSelected]}
            testID={`admin-account-edit-role-${option}`}
          >
            <Text style={[styles.chipLabel, role === option && styles.chipLabelSelected]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <Text style={styles.errorText} testID="admin-account-edit-error">
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <PrimaryButton
          label="Save"
          onPress={save}
          loading={submitting}
          disabled={username.trim().length === 0}
          testID="admin-account-edit-save"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginTop: spacing.xxxl + spacing.xxl,
    marginBottom: spacing.sm,
  },
  heading: { ...type.title, color: colors.ink },
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
    minHeight: 44,
  },
  chipRow: { flexDirection: 'row', gap: spacing.md },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...cardShadow,
  },
  chipSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  chipLabel: { ...type.bodyStrong, color: colors.inkSoft, textTransform: 'capitalize' },
  chipLabelSelected: { color: colors.primaryDeep },
  errorText: { ...type.body, color: colors.error, marginTop: spacing.lg },
  actions: { marginTop: spacing.xl },
});
