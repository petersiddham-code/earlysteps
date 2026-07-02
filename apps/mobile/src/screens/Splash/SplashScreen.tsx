import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * Routes based on resumed session state (product plan Screen 1): no family yet -> Consent
 * Center; a family but no child -> Child Profile Setup; both -> Results. If the child has
 * no computed results yet (questionnaire never submitted), the Results screen forwards to
 * the Questionnaire — safe now that the scoring engine dedupes re-answered questions.
 */
export function SplashScreen({ navigation }: Props) {
  const { isLoading, familyId, childId } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!familyId) {
      navigation.replace('ConsentCenter');
    } else if (!childId) {
      navigation.replace('ChildProfileSetup');
    } else {
      navigation.replace('Results');
    }
  }, [isLoading, familyId, childId, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EarlySteps</Text>
      <ActivityIndicator style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2933',
    marginBottom: 16,
  },
  spinner: {
    marginTop: 8,
  },
});
