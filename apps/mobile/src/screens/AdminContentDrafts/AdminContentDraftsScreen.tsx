import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminContentDraft } from '@earlysteps/shared-types';
import { discardAdminContentDraft, getAdminContentDrafts } from '../../api/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminContentDrafts'>;

/**
 * Issue #127: pending content-edit drafts. Discard-only — there is deliberately no
 * "publish"/"approve" action here. A draft going live still requires a human to turn it
 * into a real packages/content JSON change via a normal PR + CI + clinical-review sign-off
 * (CLAUDE.md §9); see docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md.
 */
export function AdminContentDraftsScreen({ route }: Props) {
  const contentKey = route.params?.contentKey;
  const [drafts, setDrafts] = useState<AdminContentDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  const load = useCallback(() => {
    getAdminContentDrafts(contentKey)
      .then(setDrafts)
      .catch(() => setError("We couldn't load drafts. Please try again."));
  }, [contentKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDiscard = async (draftId: string) => {
    setDiscardingId(draftId);
    try {
      await discardAdminContentDraft(draftId);
      setDrafts((prev) => (prev ? prev.filter((d) => d.id !== draftId) : prev));
    } catch {
      setError("We couldn't discard that draft. Please try again.");
    } finally {
      setDiscardingId(null);
    }
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!drafts) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
      <Text style={styles.heading}>
        {contentKey ? `Drafts — ${contentKey}` : 'Pending drafts'}
      </Text>
      <View style={styles.banner} testID="admin-content-drafts-banner">
        <Text style={styles.bannerText}>
          Nothing here is live. Discarding removes a proposal; publishing still happens
          through a reviewed PR with clinical sign-off, outside this console.
        </Text>
      </View>
      {drafts.length === 0 ? (
        <Text style={styles.emptyText} testID="admin-content-drafts-empty">
          No pending drafts.
        </Text>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={drafts}
          keyExtractor={(draft) => draft.id}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`admin-content-draft-${item.id}`}>
              <Text style={styles.rowMeta}>
                {item.content_key} · {item.field_path}
              </Text>
              <Text style={styles.rowCurrent}>Current: {item.current_value}</Text>
              <Text style={styles.rowProposed}>Proposed: {item.proposed_value}</Text>
              <Text style={styles.rowNote}>"{item.note}"</Text>
              <Text style={styles.rowMeta}>
                {item.created_by} · {new Date(item.created_at).toLocaleString()}
              </Text>
              <View style={styles.discardButton}>
                <PrimaryButton
                  label="Discard"
                  variant="quiet"
                  onPress={() => handleDiscard(item.id)}
                  loading={discardingId === item.id}
                  testID={`admin-content-discard-${item.id}`}
                />
              </View>
            </View>
          )}
        />
      )}
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
  errorText: { ...type.body, color: colors.error, textAlign: 'center' },
  emptyText: {
    ...type.body,
    color: colors.inkSoft,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  banner: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  bannerText: { ...type.caption, color: colors.ink },
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
  rowMeta: { ...type.caption, color: colors.inkSoft },
  rowCurrent: { ...type.body, color: colors.inkSoft, marginTop: spacing.sm },
  rowProposed: { ...type.bodyStrong, color: colors.ink, marginTop: spacing.xs },
  rowNote: {
    ...type.caption,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  discardButton: { marginTop: spacing.md, alignSelf: 'flex-start', minWidth: 120 },
});
