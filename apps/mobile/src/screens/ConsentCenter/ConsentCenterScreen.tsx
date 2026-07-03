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
import { CONSENT_COPY } from '@earlysteps/content';
import { ConsentToggle } from '../../components/ConsentToggle/ConsentToggle.js';
import { PrimaryButton } from '../../components/PrimaryButton/PrimaryButton.js';
import { createFamily, getChild, getFamily, updateConsent } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { colors, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsentCenter'>;

/**
 * Product plan Screen 2: layered consent, each togglable independently, each with a 1-line
 * plain explanation (rendered by <ConsentToggle/>, copy sourced from @earlysteps/content).
 * Creates the Family record on first visit — consent itself is granted via separate,
 * per-scope calls after, never bundled into account creation (CLAUDE.md §2 rule 9). On a
 * revisit (session already has a family — e.g. routed back here because saving answers was
 * declined for missing data_storage consent) it loads the existing family instead.
 *
 * Continue requires data_storage: without it the backend (correctly) refuses to save any
 * answers, so letting the caregiver walk into the questionnaire would dead-end them at a
 * refusal. The other three scopes stay genuinely optional.
 */
export function ConsentCenterScreen({ navigation }: Props) {
  const { familyId, childId, setFamilyId } = useSession();
  const [family, setFamily] = useState<Family | null>(null);
  const [childName, setChildName] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<ConsentScope | null>(null);
  const [attempt, setAttempt] = useState(0);

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

  const hasDataStorage = family.consent_flags.data_storage === true;

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
      {!hasDataStorage && (
        <Text style={styles.requiredNote}>
          To continue, please turn on "{CONSENT_COPY.scopes.data_storage.label}" — without
          it we have nowhere to keep your answers. Everything else is optional.
        </Text>
      )}
      <View style={styles.continueButton}>
        <PrimaryButton
          label="Continue"
          disabled={!hasDataStorage}
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
  requiredNote: {
    marginTop: spacing.lg,
    ...type.caption,
    color: colors.inkSoft,
  },
  continueButton: {
    marginTop: spacing.xxl,
  },
});
