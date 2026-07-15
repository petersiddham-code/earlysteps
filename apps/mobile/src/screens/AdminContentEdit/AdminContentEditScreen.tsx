import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminContentDetail, AdminEditableField } from '@earlysteps/shared-types';
import { ApiError } from '../../api/client.js';
import { createAdminContentDraft, getAdminContentDetail } from '../../api/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminContentEdit'>;

/**
 * Issue #127: field-level draft editor. Which fields appear here is decided entirely
 * server-side (admin-content-registry.ts) — this screen just renders whatever the API
 * returns and never assumes a field is safe on its own. Submitting never publishes
 * anything; see the banner below and docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md.
 */
export function AdminContentEditScreen({ navigation, route }: Props) {
  const { contentKey } = route.params;
  const [detail, setDetail] = useState<AdminContentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [proposedValue, setProposedValue] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftedPaths, setDraftedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getAdminContentDetail(contentKey)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError("We couldn't load this content. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [contentKey]);

  const startEditing = (field: AdminEditableField) => {
    setEditingPath(field.path);
    setProposedValue(field.current_value);
    setNote('');
    setSubmitError(null);
  };

  const cancelEditing = () => {
    setEditingPath(null);
    setSubmitError(null);
  };

  const submitDraft = async (field: AdminEditableField) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createAdminContentDraft(contentKey, {
        field_path: field.path,
        proposed_value: proposedValue,
        note,
      });
      setDraftedPaths((prev) => new Set(prev).add(field.path));
      setEditingPath(null);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "We couldn't save this draft. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
      <Text style={styles.heading}>{detail.content_key}</Text>
      <View style={styles.banner} testID="admin-content-edit-banner">
        <Text style={styles.bannerText}>
          Proposing an edit here never changes what families see. It saves a draft for
          review — going live still needs a reviewed PR and clinical sign-off, same as
          today.
        </Text>
      </View>
      <Pressable
        onPress={() => navigation.navigate('AdminContentDrafts', { contentKey })}
        testID="admin-content-edit-view-drafts"
      >
        <Text style={styles.viewDraftsLink}>View pending drafts for this content →</Text>
      </Pressable>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={detail.fields}
        keyExtractor={(field) => field.path}
        renderItem={({ item }) => {
          const isEditing = editingPath === item.path;
          const wasDrafted = draftedPaths.has(item.path);
          return (
            <View style={styles.row} testID={`admin-content-field-${item.path}`}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowValue}>{item.current_value}</Text>
              {wasDrafted && !isEditing && (
                <Text
                  style={styles.draftedBadge}
                  testID={`admin-content-drafted-${item.path}`}
                >
                  Drafted ✓
                </Text>
              )}
              {isEditing ? (
                <View style={styles.editForm}>
                  <Text style={styles.editLabel}>Proposed value</Text>
                  <TextInput
                    style={styles.editInput}
                    value={proposedValue}
                    onChangeText={setProposedValue}
                    multiline
                    testID={`admin-content-value-input-${item.path}`}
                  />
                  <Text style={styles.editLabel}>Why (required)</Text>
                  <TextInput
                    style={styles.editInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Explain the reason for this change"
                    placeholderTextColor={colors.inkSoft}
                    multiline
                    testID={`admin-content-note-input-${item.path}`}
                  />
                  {submitError && (
                    <Text style={styles.errorText} testID="admin-content-submit-error">
                      {submitError}
                    </Text>
                  )}
                  <View style={styles.editActions}>
                    <View style={styles.editActionButton}>
                      <PrimaryButton
                        label="Cancel"
                        onPress={cancelEditing}
                        variant="quiet"
                        testID={`admin-content-cancel-${item.path}`}
                      />
                    </View>
                    <View style={styles.editActionButton}>
                      <PrimaryButton
                        label="Save as draft"
                        onPress={() => submitDraft(item)}
                        disabled={
                          proposedValue.trim().length === 0 || note.trim().length === 0
                        }
                        loading={submitting}
                        testID={`admin-content-submit-${item.path}`}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => startEditing(item)}
                  style={styles.proposeButton}
                  testID={`admin-content-propose-${item.path}`}
                >
                  <Text style={styles.proposeButtonText}>Propose edit</Text>
                </Pressable>
              )}
            </View>
          );
        }}
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
  errorText: { ...type.body, color: colors.error, textAlign: 'center' },
  banner: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  bannerText: { ...type.caption, color: colors.ink },
  viewDraftsLink: {
    ...type.body,
    color: colors.primary,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
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
  rowLabel: { ...type.bodyStrong, color: colors.ink, textTransform: 'capitalize' },
  rowValue: { ...type.body, color: colors.inkSoft, marginTop: spacing.xs },
  draftedBadge: { ...type.caption, color: colors.primaryDeep, marginTop: spacing.sm },
  proposeButton: { marginTop: spacing.md, alignSelf: 'flex-start' },
  proposeButtonText: { ...type.bodyStrong, color: colors.primary },
  editForm: { marginTop: spacing.md },
  editLabel: { ...type.caption, color: colors.inkSoft, marginTop: spacing.sm },
  editInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.background,
    marginTop: spacing.xs,
    minHeight: 44,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  editActionButton: { flex: 1 },
});
