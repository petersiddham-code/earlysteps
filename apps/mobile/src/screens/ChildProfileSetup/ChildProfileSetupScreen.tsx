import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MVP_AGE_BANDS, type AgeBand } from '@earlysteps/shared-types';
import { createChild } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildProfileSetup'>;

/** Ages we can actually screen right now — the questionnaire only has Toddler/Preschool
 * content shipped (see docs/clinical-review/content-gaps.md item 4). Not offering an age
 * that would dead-end at an empty questionnaire. */
const AGE_BAND_LABELS: Record<AgeBand, string> = {
  toddler: 'Toddler (12–36 months)',
  preschool: 'Preschool (3–5 years)',
  primary: 'Primary (6–12 years)',
  teen: 'Teen (13–18 years)',
};

const LANGUAGE_OPTIONS = ['English', 'Spanish', 'Mandarin', 'Hindi', 'Arabic', 'French'];

/** Product plan Screen 3 — no photo/avatar required (no media capture at this step). */
export function ChildProfileSetupScreen({ navigation }: Props) {
  const { familyId, setChildId } = useSession();
  const [nickname, setNickname] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue =
    nickname.trim().length > 0 && ageBand !== null && languages.length > 0;

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const handleContinue = async () => {
    if (!familyId || !ageBand) return;
    setSubmitting(true);
    setError(null);
    try {
      const child = await createChild(familyId, {
        nickname: nickname.trim(),
        age_band: ageBand,
        languages,
      });
      await setChildId(child.id);
      navigation.replace('Questionnaire');
    } catch {
      setError("We couldn't save that. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Tell us about your child</Text>

      <Text style={styles.label}>What should we call them?</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="Nickname"
        accessibilityLabel="Child's nickname"
      />

      <Text style={styles.label}>How old are they?</Text>
      <View style={styles.optionRow}>
        {MVP_AGE_BANDS.map((band) => (
          <Pressable
            key={band}
            onPress={() => setAgeBand(band)}
            style={[styles.optionButton, ageBand === band && styles.optionButtonSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: ageBand === band }}
          >
            <Text
              style={[styles.optionText, ageBand === band && styles.optionTextSelected]}
            >
              {AGE_BAND_LABELS[band]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Which language(s) does your family mainly speak?</Text>
      <Text style={styles.hint}>Pick all that apply.</Text>
      <View style={styles.chipRow}>
        {LANGUAGE_OPTIONS.map((lang) => (
          <Pressable
            key={lang}
            onPress={() => toggleLanguage(lang)}
            style={[styles.chip, languages.includes(lang) && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: languages.includes(lang) }}
          >
            <Text
              style={[
                styles.chipText,
                languages.includes(lang) && styles.chipTextSelected,
              ]}
            >
              {lang}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.continueButton}>
        {submitting ? (
          <ActivityIndicator />
        ) : (
          <Pressable
            testID="continue-button"
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canContinue }}
            style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1F2933', marginBottom: 20 },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2933',
    marginTop: 16,
    marginBottom: 6,
  },
  hint: { fontSize: 12, color: '#5A6672', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D9E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  optionRow: { gap: 8 },
  optionButton: {
    borderWidth: 1,
    borderColor: '#D1D9E0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionButtonSelected: { borderColor: '#2E7D6B', backgroundColor: '#E3F2F1' },
  optionText: { fontSize: 15, color: '#1F2933' },
  optionTextSelected: { fontWeight: '600', color: '#1F3A38' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#D1D9E0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipSelected: { borderColor: '#2E7D6B', backgroundColor: '#E3F2F1' },
  chipText: { fontSize: 14, color: '#1F2933' },
  chipTextSelected: { fontWeight: '600', color: '#1F3A38' },
  errorText: { fontSize: 14, color: '#C0392B', marginTop: 16 },
  continueButton: { marginTop: 28, marginBottom: 20 },
  primaryButton: {
    backgroundColor: '#2E7D6B',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: { backgroundColor: '#B7C6C3' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
