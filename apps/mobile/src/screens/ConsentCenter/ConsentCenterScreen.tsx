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
import { ConsentToggle } from '../../components/ConsentToggle/ConsentToggle.js';
import { createFamily, updateConsent } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsentCenter'>;

/**
 * Product plan Screen 2: layered consent, each togglable independently, each with a 1-line
 * plain explanation (rendered by <ConsentToggle/>, copy sourced from @earlysteps/content).
 * Creates the Family record on first visit — consent itself is granted via separate,
 * per-scope calls after, never bundled into account creation (CLAUDE.md §2 rule 9).
 */
export function ConsentCenterScreen({ navigation }: Props) {
  const { familyId, setFamilyId } = useSession();
  const [family, setFamily] = useState<Family | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingScope, setPendingScope] = useState<ConsentScope | null>(null);

  useEffect(() => {
    if (familyId) return; // defensive — Splash only routes here without one
    // TODO: derive from device locale (expo-localization) once multi-language ships.
    createFamily({ locale: 'en' })
      .then((created) => {
        setFamily(created);
        return setFamilyId(created.id);
      })
      .catch(() => setError("We couldn't start your session. Please try again."));
  }, [familyId, setFamilyId]);

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
        <Button title="Try again" onPress={() => setError(null)} />
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
      <View style={styles.continueButton}>
        <Button
          title="Continue"
          onPress={() => navigation.replace('ChildProfileSetup')}
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
  continueButton: {
    marginTop: 24,
  },
});
