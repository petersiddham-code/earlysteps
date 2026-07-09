import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CONSENT_SCOPES, type ConsentScope, type Family } from '@earlysteps/shared-types';
import { ConsentToggle } from '../../components/ConsentToggle/ConsentToggle.js';
import { PrimaryButton } from '../../components/PrimaryButton/PrimaryButton.js';
import {
  createFamily,
  deleteFamily,
  getChild,
  getFamily,
  updateConsent,
} from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { colors, spacing, type } from '../../theme/index.js';

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
  const { familyId, childId, setFamilyId, reset } = useSession();
  const [family, setFamily] = useState<Family | null>(null);
  const [childName, setChildName] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<ConsentScope | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      {CONSENT_SCOPES.map((scope) => (
        <ConsentToggle
          key={scope}
          scope={scope}
          value={family.consent_flags[scope] === true}
          onChange={(next) => handleToggle(scope, next)}
          childName={childName}
        />
      ))}
      {pendingScope && (
        <ActivityIndicator style={styles.pendingIndicator} color={colors.primary} />
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
          unambiguous about permanence. */}
      <View style={styles.deleteSection}>
        <Text style={styles.deleteHeading}>Delete everything</Text>
        <Text style={styles.deleteBody}>
          Permanently removes everything saved here — the child details, all answers, and
          all results. This cannot be undone.
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
              Are you sure? Everything will be gone for good, and we can't bring it back.
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
