import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AdminContentSummary,
  AdminEditableContentKey,
} from '@earlysteps/shared-types';
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
 * Content keys with no dedicated summary card (issue #127) — every registered key besides
 * the question banks and red-flag copy, which already get one above. See
 * admin-content-registry.ts for what's actually draftable within each.
 */
const OTHER_CONTENT_KEYS: { key: AdminEditableContentKey; label: string }[] = [
  { key: 'result-copy.labels', label: 'Result copy' },
  { key: 'domain-resources', label: 'Domain resources' },
  { key: 'follow-ups', label: 'Follow-up questions' },
  { key: 'consent.copy', label: 'Consent copy' },
  { key: 'ai-results-summary.copy', label: 'AI assessment copy' },
  { key: 'comparison.copy', label: 'Comparison copy' },
];

/**
 * Human-readable labels for clinical_signoff's content keys (issue #129). Weights and
 * evidence-floors aren't admin-draftable (admin-content-registry.ts) so they have no card
 * elsewhere on this screen — this list is the only place their sign-off status is visible.
 */
const SIGNOFF_KEY_LABELS: Record<string, string> = {
  weights: 'Scoring weights',
  'evidence-floors': 'Evidence floors',
  'result-copy': 'Result copy',
  'red-flag-copy': 'Red-flag copy',
  'domain-resources': 'Domain resources',
  'follow-ups': 'Follow-up questions',
  'ai-results-summary-copy': 'AI assessment copy',
  'comparison-copy': 'Comparison copy',
};

/**
 * Issue #125, Admin Console v1: question banks + red-flag copy versions. Issue #127 adds
 * draft-only editing — every row here navigates into AdminContentEdit for that content
 * key; nothing on this screen itself writes content (see AdminContentEditScreen).
 */
export function AdminContentScreen({ navigation }: Props) {
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
      <Text style={styles.heading}>Content</Text>
      <Pressable
        onPress={() =>
          navigation.navigate('AdminContentDrafts', { contentKey: undefined })
        }
        testID="admin-content-view-all-drafts"
      >
        <Text style={styles.viewDraftsLink}>View all pending drafts →</Text>
      </Pressable>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={summary.question_banks}
        keyExtractor={(bank) => bank.age_band}
        ListHeaderComponent={
          <>
            <Pressable
              onPress={() =>
                navigation.navigate('AdminContentEdit', {
                  contentKey: 'result-copy.red-flag-copy',
                })
              }
              style={styles.redFlagCard}
              testID="admin-red-flag-summary"
            >
              <Text style={styles.rowName}>
                Red-flag copy v{summary.red_flag_copy_version}
              </Text>
              <Text style={styles.rowMeta}>
                {summary.red_flag_copy_needs_signoff
                  ? 'Awaiting clinical sign-off'
                  : 'Signed off'}
              </Text>
            </Pressable>
            <Text style={styles.sectionHeading}>Clinical sign-off status</Text>
            {summary.clinical_signoff.map((status) => (
              <View
                key={status.key}
                style={styles.row}
                testID={`admin-clinical-signoff-${status.key}`}
              >
                <Text style={styles.rowName}>
                  {SIGNOFF_KEY_LABELS[status.key] ?? status.key}
                </Text>
                <Text
                  style={[
                    styles.rowMeta,
                    status.needs_signoff ? styles.rowMetaPending : null,
                  ]}
                >
                  v{status.version} ·{' '}
                  {status.needs_signoff ? 'Awaiting clinical sign-off' : 'Signed off'}
                </Text>
              </View>
            ))}
            <Text style={styles.sectionHeading}>Question banks</Text>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('AdminContentEdit', {
                contentKey: `questions.${item.age_band}` as AdminEditableContentKey,
              })
            }
            style={styles.row}
            testID={`admin-content-bank-${item.age_band}`}
          >
            <Text style={styles.rowName}>{bandLabel(item.age_band)}</Text>
            <Text style={styles.rowMeta}>
              v{item.version} · {item.locale} · {item.question_count} questions
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <>
            <Text style={styles.sectionHeading}>Other content</Text>
            {OTHER_CONTENT_KEYS.map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() =>
                  navigation.navigate('AdminContentEdit', { contentKey: key })
                }
                style={styles.row}
                testID={`admin-content-other-${key}`}
              >
                <Text style={styles.rowName}>{label}</Text>
              </Pressable>
            ))}
          </>
        }
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
  viewDraftsLink: {
    ...type.body,
    color: colors.primary,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  sectionHeading: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  redFlagCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
  rowMetaPending: { color: colors.error },
});
