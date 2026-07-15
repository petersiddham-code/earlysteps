import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminContentSummary } from '@earlysteps/shared-types';
import { getAdminContentSummary } from '../../api/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminContent'>;

/** Presentation only — the raw age-band id, made readable ("young_adult" -> "Young adult"). */
function bandLabel(ageBand: string): string {
  const spaced = ageBand.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Issue #125, Admin Console v1: READ-ONLY view of question banks + red-flag copy
 * versions. No editing here — a write endpoint would need the CLAUDE.md §9 clinical
 * content review gate wired into this console, deliberately deferred to a later issue.
 */
export function AdminContentScreen(_props: Props) {
  const [summary, setSummary] = useState<AdminContentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminContentSummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load content. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
      <Text style={styles.heading}>Content (read-only)</Text>
      <View style={styles.redFlagCard} testID="admin-red-flag-summary">
        <Text style={styles.rowName}>Red-flag copy v{summary.red_flag_copy_version}</Text>
        <Text style={styles.rowMeta}>
          {summary.red_flag_copy_needs_signoff
            ? 'Awaiting clinical sign-off'
            : 'Signed off'}
        </Text>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={summary.question_banks}
        keyExtractor={(bank) => bank.age_band}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`admin-content-bank-${item.age_band}`}>
            <Text style={styles.rowName}>{bandLabel(item.age_band)}</Text>
            <Text style={styles.rowMeta}>
              v{item.version} · {item.locale} · {item.question_count} questions
            </Text>
          </View>
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
  errorText: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  redFlagCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
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
