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
import {
  GENDER_OPTIONS,
  OTHER_OPTION_ID,
  deriveAgeBand,
  type AgeBand,
  type GenderOption,
} from '@earlysteps/shared-types';
import { getQuestionBank } from '@earlysteps/content';
import { createChild } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildProfileSetup'>;

/** Caregiver-facing names for the derived band, shown as reassurance under the birth date. */
const AGE_BAND_LABELS: Record<AgeBand, string> = {
  toddler: 'Toddler (12–36 months)',
  preschool: 'Preschool (3–5 years)',
  primary: 'Primary (6–12 years)',
  teen: 'Teen (13–18 years)',
  young_adult: 'Young adult (19–25 years)',
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Optional, inclusively-worded gender choices (issue #25). Captured only — nothing in the
 * app uses it yet, and any future use is gated clinical content (CLAUDE.md §9).
 */
const GENDER_LABELS: Record<GenderOption, string> = {
  girl: 'Girl',
  boy: 'Boy',
  self_describe: 'Prefer to self-describe',
  prefer_not_to_say: 'Prefer not to say',
};

/**
 * Language chips come from bank question U2 — the reviewed, versioned source of truth for
 * this question (it's `collected_at: "profile_setup"`, i.e. answered HERE instead of in
 * the questionnaire, #24/#27). The "other" option is split out: it renders as a chip that
 * reveals an inline input (#28) rather than a plain choice.
 */
const U2_OPTIONS =
  getQuestionBank('universal')?.questions.find((q) => q.id === 'U2')?.options ?? [];
const LANGUAGE_OPTIONS = U2_OPTIONS.filter((o) => o.id !== OTHER_OPTION_ID).map(
  (o) => o.label,
);
const OTHER_LANGUAGE_LABEL =
  U2_OPTIONS.find((o) => o.id === OTHER_OPTION_ID)?.label ?? 'Other — type it';

/**
 * Product plan Screen 3 — no photo/avatar required (no media capture at this step).
 *
 * Issue #25: the caregiver enters the child's birth month + year (never the full date —
 * month granularity is enough for every band boundary while storing less identifying
 * data) and the age band is DERIVED, not picked. The derived band is shown back as
 * reassurance, and the backend re-derives it at read time, so the questionnaire always
 * serves the right bank even as the child ages between sessions.
 */
export function ChildProfileSetupScreen({ navigation }: Props) {
  const { familyId, setChildId } = useSession();
  const [nickname, setNickname] = useState('');
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthYearText, setBirthYearText] = useState('');
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [genderDetail, setGenderDetail] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [otherLanguageSelected, setOtherLanguageSelected] = useState(false);
  const [otherLanguage, setOtherLanguage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const birthYear = /^\d{4}$/.test(birthYearText) ? Number(birthYearText) : null;
  const derivedBand =
    birthMonth !== null && birthYear !== null
      ? deriveAgeBand(birthMonth, birthYear)
      : null;
  const birthComplete = birthMonth !== null && birthYear !== null;

  // "Other" only counts as a language once something is actually typed — a checked chip
  // with an empty box mustn't unlock Continue (#28).
  const typedLanguage = otherLanguageSelected ? otherLanguage.trim() : '';
  const effectiveLanguages = typedLanguage ? [...languages, typedLanguage] : languages;

  const canContinue =
    nickname.trim().length > 0 && derivedBand !== null && effectiveLanguages.length > 0;

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  // Unchecking "Other" clears what was typed — no invisible language may ride along.
  const toggleOtherLanguage = () => {
    setOtherLanguageSelected((prev) => {
      if (prev) setOtherLanguage('');
      return !prev;
    });
  };

  // Tapping the selected option again clears it — gender stays genuinely optional, never
  // a one-way choice the caregiver can't back out of.
  const toggleGender = (option: GenderOption) => {
    setGender((prev) => (prev === option ? null : option));
  };

  const handleContinue = async () => {
    if (!familyId || birthMonth === null || birthYear === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const detail = genderDetail.trim();
      const child = await createChild(familyId, {
        nickname: nickname.trim(),
        birth_month: birthMonth,
        birth_year: birthYear,
        ...(gender ? { gender } : {}),
        ...(gender === 'self_describe' && detail ? { gender_detail: detail } : {}),
        languages: effectiveLanguages,
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
        maxLength={100}
        accessibilityLabel="Child's nickname"
      />

      <Text style={styles.label}>When were they born?</Text>
      <Text style={styles.hint}>
        Just the month and year — we use it to show questions made for their age.
      </Text>
      <View style={styles.chipRow}>
        {MONTHS.map((label, i) => {
          const month = i + 1;
          const selected = birthMonth === month;
          return (
            <Pressable
              key={label}
              onPress={() => setBirthMonth(month)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={[styles.input, styles.yearInput]}
        value={birthYearText}
        onChangeText={(next) => setBirthYearText(next.replace(/[^\d]/g, ''))}
        placeholder="Year (e.g. 2024)"
        placeholderTextColor={colors.inkSoft}
        keyboardType="number-pad"
        maxLength={4}
        accessibilityLabel="Year of birth"
      />
      {birthComplete && derivedBand && (
        <View style={styles.bandPreview} testID="derived-band">
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.bandPreviewText}>
            That's the {AGE_BAND_LABELS[derivedBand]} range — we'll show questions made
            for that age.
          </Text>
        </View>
      )}
      {birthComplete && !derivedBand && (
        <Text style={styles.rangeNotice} testID="age-range-notice">
          Our check-ins are designed for ages 12 months to 25 years. Please check the
          month and year.
        </Text>
      )}

      <Text style={styles.label}>Their gender (optional)</Text>
      <Text style={styles.hint}>
        Skip this if you'd rather — it's entirely up to you.
      </Text>
      <View style={styles.chipRow}>
        {GENDER_OPTIONS.map((option) => {
          const selected = gender === option;
          return (
            <Pressable
              key={option}
              onPress={() => toggleGender(option)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {GENDER_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {gender === 'self_describe' && (
        <TextInput
          style={styles.input}
          value={genderDetail}
          onChangeText={setGenderDetail}
          placeholder="In your own words (optional)"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Describe their gender in your own words"
        />
      )}

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
        <Pressable
          onPress={toggleOtherLanguage}
          style={[styles.chip, otherLanguageSelected && styles.chipSelected]}
          accessibilityRole="button"
          accessibilityState={{ selected: otherLanguageSelected }}
          testID="other-language-chip"
        >
          <Text
            style={[styles.chipText, otherLanguageSelected && styles.chipTextSelected]}
          >
            {OTHER_LANGUAGE_LABEL}
          </Text>
        </Pressable>
      </View>
      {otherLanguageSelected && (
        <TextInput
          style={styles.input}
          value={otherLanguage}
          onChangeText={setOtherLanguage}
          placeholder="Type your language here"
          placeholderTextColor={colors.inkSoft}
          maxLength={100}
          accessibilityLabel="Type your language here"
          testID="other-language-input"
          autoFocus
        />
      )}

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
  yearInput: { marginTop: spacing.sm },
  bandPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  bandPreviewText: { ...type.caption, color: colors.ink, flex: 1 },
  rangeNotice: { ...type.caption, color: colors.inkSoft, marginTop: spacing.sm },
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
