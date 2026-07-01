import { Button, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ComingSoon'>;

/**
 * Temporary landing spot after onboarding completes — the Parent Questionnaire and Results
 * screens are the next piece of work. Real family/child ids ARE created and persisted by the
 * time you reach here; this screen just doesn't have anywhere further to send you yet.
 */
export function ComingSoonScreen({ navigation }: Props) {
  const { familyId, childId, reset } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're all set!</Text>
      <Text style={styles.subtitle}>
        The questionnaire is coming next — for now, here's what's saved:
      </Text>
      <Text style={styles.detail}>Family: {familyId}</Text>
      <Text style={styles.detail}>Child: {childId}</Text>
      <View style={styles.resetButton}>
        <Button
          title="Start over"
          onPress={async () => {
            await reset();
            navigation.replace('Splash');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#1F2933', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#5A6672', textAlign: 'center', marginBottom: 16 },
  detail: { fontSize: 13, color: '#5A6672' },
  resetButton: { marginTop: 24 },
});
