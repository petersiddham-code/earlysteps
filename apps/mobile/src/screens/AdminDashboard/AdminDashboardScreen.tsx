import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminAccountSummary } from '@earlysteps/shared-types';
import { getAdminAccounts } from '../../api/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

/**
 * Issue #125, Admin Console v1: operations overview — account list with tier/role and
 * family/child counts only. Never renders question answers, scores, reports, free text,
 * or media (CLAUDE.md §2 rule 10's PII-minimization principle, extended to admin views).
 */
export function AdminDashboardScreen({ navigation }: Props) {
  const [accounts, setAccounts] = useState<AdminAccountSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(() => {
    getAdminAccounts()
      .then(setAccounts)
      .catch(() => setError("We couldn't load accounts. Please try again."));
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /**
   * Issue #131: re-fetches whenever this screen regains focus (e.g. returning from
   * AdminAccountEdit after a save), not just on first mount — otherwise an edited
   * account's row would keep showing its pre-edit values until the app reloads.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAccounts);
    return unsubscribe;
  }, [navigation, loadAccounts]);

  const premiumCount = accounts?.filter((a) => a.tier === 'premium').length ?? 0;

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!accounts) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
      <Text style={styles.heading}>Operations dashboard</Text>
      <Text style={styles.summary} testID="admin-accounts-summary">
        {accounts.length} account{accounts.length === 1 ? '' : 's'} · {premiumCount}{' '}
        premium
      </Text>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => navigation.navigate('AdminContent')}
          style={styles.navButton}
          testID="admin-nav-content"
        >
          <Text style={styles.navButtonText}>Content</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('AdminReviewLog')}
          style={styles.navButton}
          testID="admin-nav-review-log"
        >
          <Text style={styles.navButtonText}>Review log</Text>
        </Pressable>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={accounts}
        keyExtractor={(account) => account.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            testID={`admin-account-row-${item.id}`}
            onPress={() => navigation.navigate('AdminAccountEdit', { account: item })}
          >
            <Text style={styles.rowName}>{item.username}</Text>
            <Text style={styles.rowMeta}>
              {item.tier} tier · {item.role} · {item.family_count} famil
              {item.family_count === 1 ? 'y' : 'ies'} · {item.child_count} child
              {item.child_count === 1 ? '' : 'ren'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginTop: spacing.xxxl + spacing.xxl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  heading: { ...type.title, color: colors.ink, marginHorizontal: spacing.xl },
  summary: {
    ...type.body,
    color: colors.inkSoft,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  errorText: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  navButton: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  navButtonText: { ...type.bodyStrong, color: colors.primaryDeep },
  list: { flex: 1, marginTop: spacing.lg },
  listContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    ...cardShadow,
  },
  rowName: { ...type.bodyStrong, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkSoft, marginTop: spacing.xs },
});
