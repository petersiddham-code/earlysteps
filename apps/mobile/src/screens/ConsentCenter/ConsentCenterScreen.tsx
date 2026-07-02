import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CONSENT_SCOPES, type ConsentScope, type Family } from '@earlysteps/shared-types';
import { CONSENT_COPY } from '@earlysteps/content';
import { ConsentToggle } from '../../components/ConsentToggle/ConsentToggle.js';
import { createFamily, getFamily, updateConsent } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

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
        <Button title="Try again" onPress={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }

  if (!family) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
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
        />
      ))}
      {pendingScope && <ActivityIndicator style={styles.pendingIndicator} />}
      {!hasDataStorage && (
        <Text style={styles.requiredNote}>
          To continue, please turn on "{CONSENT_COPY.scopes.data_storage.label}" — without
          it we have nowhere to keep your answers. Everything else is optional.
        </Text>
      )}
      <View style={styles.continueButton}>
        <Button
          title="Continue"
          disabled={!hasDataStorage}
          onPress={() => {
            // Pushed on top of the Questionnaire (consent was missing at submit)? Pop back
            // to it so the caregiver's in-progress answers are still there. Otherwise this
            // is the onboarding flow — move forward.
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
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2933',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: '#5A6672',
    marginBottom: 20,
  },
  errorText: {
    fontSize: 15,
    color: '#5A6672',
    textAlign: 'center',
    marginBottom: 16,
  },
  pendingIndicator: {
    marginTop: 8,
  },
  requiredNote: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    color: '#5A6672',
  },
  continueButton: {
    marginTop: 24,
  },
});
