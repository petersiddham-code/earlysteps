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
import { Ionicons } from '@expo/vector-icons';
import { AGE_BANDS, type AgeBand } from '@earlysteps/shared-types';
import { createChild } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildProfileSetup'>;

/** Every band ships a caregiver-answered question bank, so all are offered. */
const AGE_BAND_LABELS: Record<AgeBand, string> = {
  toddler: 'Toddler (12–36 months)',
  preschool: 'Preschool (3–5 years)',
  primary: 'Primary (6–12 years)',
  teen: 'Teen (13–18 years)',
  young_adult: 'Young adult (19–25 years)',
};

/** Decorative icons so each age band reads at a glance. */
const AGE_BAND_ICONS: Record<AgeBand, keyof typeof Ionicons.glyphMap> = {
  toddler: 'footsteps-outline',
  preschool: 'color-palette-outline',
  primary: 'school-outline',
  teen: 'headset-outline',
  young_adult: 'briefcase-outline',
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
        placeholderTextColor={colors.inkSoft}
        accessibilityLabel="Child's nickname"
      />

      <Text style={styles.label}>How old are they?</Text>
      <View style={styles.optionRow}>
        {AGE_BANDS.map((band) => (
          <Pressable
            key={band}
            onPress={() => setAgeBand(band)}
            style={[styles.optionButton, ageBand === band && styles.optionButtonSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: ageBand === band }}
          >
            <Ionicons
              name={AGE_BAND_ICONS[band]}
              size={20}
              color={ageBand === band ? colors.primaryDeep : colors.inkSoft}
              style={styles.optionIcon}
            />
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
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton
            testID="continue-button"
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  heading: { ...type.title, color: colors.ink, marginBottom: spacing.xl },
  label: {
    ...type.bodyStrong,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  hint: { ...type.caption, color: colors.inkSoft, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  optionRow: { gap: spacing.sm },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  optionIcon: { marginRight: spacing.md },
  optionText: { ...type.body, fontSize: 16, color: colors.ink },
  optionTextSelected: { ...type.bodyStrong, fontSize: 16, color: colors.primaryDeep },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { ...type.body, color: colors.ink },
  chipTextSelected: { ...type.bodyStrong, color: colors.primaryDeep },
  errorText: { ...type.body, color: colors.error, marginTop: spacing.lg },
  continueButton: { marginTop: spacing.xxl, marginBottom: spacing.xl },
});
