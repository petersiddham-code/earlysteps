import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminClinicalReviewLogEntry } from '@earlysteps/shared-types';
import { getAdminClinicalReviewLog } from '../../api/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminReviewLog'>;

/**
 * Issue #125, Admin Console v1: read-only rendering of docs/clinical-review/README.md's
 * sign-off log (CLAUDE.md §9) — that file stays the single source of truth; nothing here
 * writes back to it.
 */
export function AdminReviewLogScreen(_props: Props) {
  const [entries, setEntries] = useState<AdminClinicalReviewLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminClinicalReviewLog()
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load the review log. Please try again.");
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

  if (!entries) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
      <Text style={styles.heading}>Clinical review log</Text>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={entries}
        keyExtractor={(_entry, index) => String(index)}
        renderItem={({ item, index }) => (
          <View style={styles.row} testID={`admin-review-log-row-${index}`}>
            <Text style={styles.rowName}>
              {item.date} · {item.content_version}
            </Text>
            <Text style={styles.rowMeta}>{item.what_changed}</Text>
            <Text style={styles.rowStatus}>
              {item.advisor} — {item.status}
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
  rowStatus: { ...type.caption, color: colors.primaryDeep, marginTop: spacing.xs },
});
