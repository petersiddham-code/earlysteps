import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CONSENT_SCOPES,
  MEDIA_RETENTION_DAY_OPTIONS,
  type ConsentScope,
  type Family,
  type MediaRetentionDays,
} from '@earlysteps/shared-types';
import { CONSENT_COPY } from '@earlysteps/content';
import { ConsentToggle } from '../../components/ConsentToggle/ConsentToggle.js';
import { PrimaryButton } from '../../components/PrimaryButton/PrimaryButton.js';
import {
  createFamily,
  deleteFamily,
  getChild,
  getFamily,
  updateConsent,
  updateMediaRetention,
  upgradeTier,
} from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { colors, radius, spacing, type } from '../../theme/index.js';

/** Issue #123: recording and AI-assisted analysis are premium features — shown to every
 * logged-in caregiver so they know they exist, but only switchable once upgraded, never
 * silently hidden. */
const PREMIUM_ONLY_SCOPES: readonly ConsentScope[] = ['media_capture', 'ai_analysis'];

type Props = NativeStackScreenProps<RootStackParamList, 'ConsentCenter'>;

/**
 * Product plan Screen 2: layered consent, each togglable independently, each with a 1-line
 * plain explanation (rendered by <ConsentToggle/>, copy sourced from @earlysteps/content).
 * Creates the Family record on first visit — consent itself is granted via separate,
 * per-scope calls after, never bundled into account creation (CLAUDE.md §2 rule 9). On a
 * revisit (session already has a family — e.g. routed back here from "Review my
 * permissions") it loads the existing family instead.
 *
 * data_storage is genuinely optional, same as the other three scopes (issue #63): declining
 * it means the questionnaire and results run fully on-device instead of being saved — never
 * a dead end. See apps/mobile/src/guest/guestStore.ts for that path.
 */
export function ConsentCenterScreen({ navigation }: Props) {
  const { familyId, childId, setFamilyId, reset, isGuest, tier, setTier } = useSession();
  const [family, setFamily] = useState<Family | null>(null);
  const [childName, setChildName] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<ConsentScope | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [savingRetention, setSavingRetention] = useState(false);

  // Issue #99 hid data_storage/ai_analysis for a guest (nothing to save, no AI analysis
  // available). Issue #123 extends that: a guest also has no account to attach media to or
  // share a report from, so media_capture/professional_sharing are just as non-negotiable —
  // a guest sees no consent toggles at all, only the banner below explaining why.
  const visibleScopes: readonly ConsentScope[] = isGuest ? [] : CONSENT_SCOPES;

  const premiumScopesLocked = tier !== 'premium';
  const isLockedScope = (scope: ConsentScope) =>
    PREMIUM_ONLY_SCOPES.includes(scope) && premiumScopesLocked;

  const handleUpgrade = async () => {
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const user = await upgradeTier();
      await setTier(user.tier);
    } catch {
      setUpgradeError("We couldn't upgrade your account. Please try again.");
    } finally {
      setUpgrading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const load = familyId
      ? getFamily(familyId).then((existing) => {
          if (!cancelled) setFamily(existing);
        })
      : // TODO: derive from device locale (expo-localization) once multi-language ships.
        createFamily({ locale: 'en' }).then((created) => {
          if (cancelled) return;
          setFamily(created);
          return setFamilyId(created.id);
        });
    load.catch(() => {
      if (!cancelled) setError("We couldn't start your session. Please try again.");
    });
    return () => {
      cancelled = true;
    };
  }, [familyId, setFamilyId, attempt]);

  // On a revisit (child already set up — e.g. "Review my permissions" from Results) the
  // consent copy names the child instead of "your child" (#36). Best-effort: a failed
  // fetch just keeps the generic wording — never worth blocking the consent screen over.
  useEffect(() => {
    if (!familyId || !childId) return;
    let cancelled = false;
    getChild(familyId, childId)
      .then((child) => {
        if (!cancelled) setChildName(child.nickname);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [familyId, childId]);

  /**
   * Right-to-erasure (issue #55, product plan Screen 13): permanently deletes the family
   * and everything under it server-side, then forgets the local session and returns to a
   * fresh start. Reached only through the explicit confirmation step below.
   */
  const handleDeleteEverything = async () => {
    if (!family || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFamily(family.id);
      await reset();
      navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
    } catch {
      setDeleteError(
        "We couldn't delete your data. Please check your connection and try again.",
      );
      setDeleting(false);
    }
  };

  const handleToggle = async (scope: ConsentScope, granted: boolean) => {
    if (!family) return;
    // Belt-and-suspenders: the Switch itself is disabled for a locked scope, but never trust
    // the UI alone to enforce a tier gate.
    if (isLockedScope(scope)) return;
    setPendingScope(scope);
    try {
      const updated = await updateConsent(family.id, scope, granted);
      setFamily(updated);
    } catch {
      Alert.alert("Couldn't save that", 'Please check your connection and try again.');
    } finally {
      setPendingScope(null);
    }
  };

  /** Issue #142: shorter-only 30/60/90-day window, applies retroactively server-side. */
  const handleRetentionChange = async (days: MediaRetentionDays) => {
    if (!family || savingRetention || premiumScopesLocked) return;
    setSavingRetention(true);
    try {
      const updated = await updateMediaRetention(family.id, days);
      setFamily(updated);
    } catch {
      Alert.alert("Couldn't save that", 'Please check your connection and try again.');
    } finally {
      setSavingRetention(false);
    }
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <PrimaryButton label="Try again" onPress={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }

  if (!family) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Before we start</Text>
      <Text style={styles.subheading}>
        You're in control — turn any of these on or off, any time.
      </Text>

      {/* Issue #99/#123: a guest has no account to save to, analyse, attach media to, or
          share a report from — spell that out plainly instead of showing toggles that can
          never meaningfully turn on. */}
      {isGuest && (
        <View style={styles.guestBanner} testID="consent-guest-banner">
          <Text style={styles.guestBannerTitle}>You're browsing as a guest</Text>
          <Text style={styles.guestBannerBody}>
            Answers here aren't saved, and AI-assisted analysis, recording, and sharing
            with a professional aren't available. Log in or sign up any time to unlock
            saving your results and more.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            testID="consent-guest-login-link"
          >
            <Text style={styles.guestBannerLink}>Log in or sign up</Text>
          </Pressable>
        </View>
      )}

      {visibleScopes.map((scope) => (
        <ConsentToggle
          key={scope}
          scope={scope}
          value={family.consent_flags[scope] === true}
          onChange={(next) => handleToggle(scope, next)}
          childName={childName}
          disabled={isLockedScope(scope)}
          disabledReason={isLockedScope(scope) ? 'Available on Premium' : undefined}
        />
      ))}
      {pendingScope && (
        <ActivityIndicator style={styles.pendingIndicator} color={colors.primary} />
      )}

      {/* Issue #142: parent-facing retention window, alongside media_capture consent —
          same lock/disabled-reason pattern as the premium scopes above, never hidden. */}
      {!isGuest && (
        <View style={styles.retentionSection} testID="media-retention-section">
          <Text style={styles.retentionHeading}>
            {CONSENT_COPY.media_retention.heading}
          </Text>
          <Text style={styles.retentionBody}>
            {CONSENT_COPY.media_retention.explanation}
          </Text>
          <View style={styles.retentionOptions}>
            {MEDIA_RETENTION_DAY_OPTIONS.map((days) => {
              const selected = family.media_retention_days === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => handleRetentionChange(days)}
                  disabled={premiumScopesLocked || savingRetention}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: premiumScopesLocked }}
                  testID={`media-retention-option-${days}`}
                  style={[
                    styles.retentionOption,
                    selected && styles.retentionOptionSelected,
                    premiumScopesLocked && styles.retentionOptionDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.retentionOptionText,
                      selected && styles.retentionOptionTextSelected,
                    ]}
                  >
                    {CONSENT_COPY.media_retention.option_label.replace(
                      '{days}',
                      String(days),
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {premiumScopesLocked && (
            <Text style={styles.retentionDisabledReason}>
              {CONSENT_COPY.media_retention.disabled_reason}
            </Text>
          )}
          {savingRetention && (
            <ActivityIndicator style={styles.pendingIndicator} color={colors.primary} />
          )}
        </View>
      )}

      {/* Issue #99: self-service, one-directional upgrade — no payment gateway exists yet
          (docs/clinical-review/content-gaps.md §6). Guests aren't logged in, so there's no
          account here to upgrade. */}
      {!isGuest && tier && (
        <View style={styles.planSection} testID="consent-plan-section">
          <Text style={styles.planHeading}>Your plan</Text>
          <Text style={styles.planBody}>
            {tier === 'premium'
              ? 'Premium — AI-assisted analysis of your typed answers is available.'
              : 'Free — AI-assisted analysis of your typed answers is not included.'}
          </Text>
          {tier === 'free' && (
            <PrimaryButton
              label="Upgrade to Premium"
              variant="quiet"
              loading={upgrading}
              onPress={handleUpgrade}
              testID="upgrade-to-premium-button"
            />
          )}
          {upgradeError && <Text style={styles.deleteErrorText}>{upgradeError}</Text>}
        </View>
      )}

      <View style={styles.continueButton}>
        <PrimaryButton
          label="Continue"
          onPress={() => {
            // Pushed on top of another screen (Questionnaire when consent was missing at
            // submit — in-progress answers still there — or Results via "Review my
            // permissions")? Pop back to it. Otherwise this is onboarding — move forward.
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace(childId ? 'Questionnaire' : 'ChildProfileSetup');
            }
          }}
        />
      </View>

      {/* Right-to-erasure (issue #55, product plan Screen 13). Two deliberate taps: the
          first only reveals the confirmation, and the confirmation spells out exactly
          what disappears before anything is sent. Copy avoids alarm styling but is
          unambiguous about permanence. Guests have nothing saved to delete. */}
      {!isGuest && (
        <View style={styles.deleteSection}>
          <Text style={styles.deleteHeading}>Delete everything</Text>
          <Text style={styles.deleteBody}>
            Permanently removes everything saved here — the child details, all answers,
            and all results. This cannot be undone.
          </Text>
          {!confirmingDelete ? (
            <PrimaryButton
              label="Delete everything"
              variant="quiet"
              onPress={() => setConfirmingDelete(true)}
              testID="delete-everything-button"
            />
          ) : (
            <View testID="delete-confirm-block">
              <Text style={styles.deleteConfirmText}>
                Are you sure? Everything will be gone for good, and we can't bring it
                back.
              </Text>
              <PrimaryButton
                label="Yes, delete everything"
                loading={deleting}
                onPress={handleDeleteEverything}
                testID="confirm-delete-button"
              />
              <PrimaryButton
                label="Keep my data"
                variant="quiet"
                disabled={deleting}
                onPress={() => {
                  setConfirmingDelete(false);
                  setDeleteError(null);
                }}
                testID="cancel-delete-button"
              />
            </View>
          )}
          {deleteError && <Text style={styles.deleteErrorText}>{deleteError}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  heading: {
    ...type.title,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subheading: {
    ...type.body,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
  },
  errorText: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  pendingIndicator: {
    marginTop: spacing.sm,
  },
  guestBanner: {
    backgroundColor: colors.primaryTint,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  guestBannerTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  guestBannerBody: {
    ...type.caption,
    color: colors.inkSoft,
  },
  guestBannerLink: {
    ...type.bodyStrong,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  retentionSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  retentionHeading: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  retentionBody: {
    ...type.caption,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  retentionOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  retentionOption: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retentionOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  retentionOptionDisabled: {
    opacity: 0.6,
  },
  retentionOptionText: {
    ...type.bodyStrong,
    color: colors.ink,
  },
  retentionOptionTextSelected: {
    color: colors.primary,
  },
  retentionDisabledReason: {
    marginTop: spacing.sm,
    ...type.caption,
    color: colors.accent,
    fontWeight: '600',
  },
  planSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.disabled,
  },
  planHeading: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  planBody: {
    ...type.caption,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  continueButton: {
    marginTop: spacing.xxl,
  },
  deleteSection: {
    marginTop: spacing.xxxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.disabled,
  },
  deleteHeading: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  deleteBody: {
    ...type.caption,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  deleteConfirmText: {
    ...type.body,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  deleteErrorText: {
    marginTop: spacing.sm,
    ...type.caption,
    color: colors.inkSoft,
  },
});
