import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  RecordingPresets,
} from 'expo-audio';
import type { Family, MediaAssetView, MediaKind } from '@earlysteps/shared-types';
import { getFamily, updateConsent, uploadMedia } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import { ConsentToggle } from '../../components/ConsentToggle/ConsentToggle.js';
import { PrimaryButton } from '../../components/PrimaryButton/PrimaryButton.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ObservationRecorder'>;

const KIND_SAVED_LABEL: Record<MediaKind, string> = {
  photo: 'Photo saved',
  video: 'Video saved',
  audio: 'Sound clip saved',
};

/**
 * Observation Recorder (issue #134, product plan Screen 6): opt-in photo/video/audio
 * capture. Everything here is storage only — nothing recorded is analysed by either
 * assessment engine in Phase 1 (that's issue #135, behind its own review).
 *
 * Consent is layered and live (CLAUDE.md §2 rule 9): the persistent reminder at the top
 * reuses the existing <ConsentToggle scope="media_capture" /> — calm and factual (the
 * RedFlagBanner tone guidance, not its visual treatment; this is a reminder, not an
 * alarm) — and the capture controls only work while it's on. The server re-checks the
 * consent flag on every single upload regardless of what this screen shows.
 *
 * Declining is never a dead end: "Skip — I'll describe instead" goes back into the
 * questionnaire, whose typed notes and "Other — type it" answers are the app's existing
 * free-text channel.
 */
export function ObservationRecorderScreen({ navigation }: Props) {
  const { familyId, childId, tier } = useSession();
  const [family, setFamily] = useState<Family | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busyKind, setBusyKind] = useState<MediaKind | null>(null);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [saved, setSaved] = useState<MediaAssetView[]>([]);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [pendingConsent, setPendingConsent] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const isPremium = tier === 'premium';
  const consentGranted = family?.consent_flags.media_capture === true;
  const canCapture = isPremium && consentGranted && childId !== null && busyKind === null;

  useEffect(() => {
    // No fetch in the locked state — a free-tier session renders the upgrade note only.
    if (!familyId || !isPremium) return;
    let cancelled = false;
    setLoadError(null);
    getFamily(familyId)
      .then((loaded) => {
        if (!cancelled) setFamily(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("We couldn't load your permissions. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [familyId, isPremium, attempt]);

  const handleConsentToggle = async (granted: boolean) => {
    if (!family || pendingConsent) return;
    setPendingConsent(true);
    try {
      const updated = await updateConsent(family.id, 'media_capture', granted);
      setFamily(updated);
    } catch {
      setCaptureError("We couldn't save that change. Please try again.");
    } finally {
      setPendingConsent(false);
    }
  };

  const upload = async (kind: MediaKind, fileUri: string, mimeType: string) => {
    if (!childId) return;
    setBusyKind(kind);
    setCaptureError(null);
    try {
      const asset = await uploadMedia({ childId, kind, fileUri, mimeType });
      if (asset) setSaved((prev) => [...prev, asset]);
    } catch {
      setCaptureError(
        "We couldn't save that just now. It hasn't been stored — please try again.",
      );
    } finally {
      setBusyKind(null);
    }
  };

  const captureWithCamera = async (kind: 'photo' | 'video') => {
    setCaptureError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCaptureError(
        'Camera access is off for this app in your device settings. You can change that any time, or describe the moment in words instead.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(
      kind === 'photo'
        ? { mediaTypes: ['images'], quality: 0.7 }
        : { mediaTypes: ['videos'], videoMaxDuration: 60 },
    );
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    await upload(
      kind,
      asset.uri,
      asset.mimeType ?? (kind === 'photo' ? 'image/jpeg' : 'video/mp4'),
    );
  };

  const toggleAudioRecording = async () => {
    setCaptureError(null);
    if (recordingAudio) {
      setRecordingAudio(false);
      await audioRecorder.stop();
      if (audioRecorder.uri) {
        await upload('audio', audioRecorder.uri, 'audio/m4a');
      }
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setCaptureError(
        'Microphone access is off for this app in your device settings. You can change that any time, or describe the moment in words instead.',
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setRecordingAudio(true);
  };

  // Defensive: the only entry point is premium-gated, but never trust the UI alone.
  if (!isPremium) {
    return (
      <View style={styles.centered} testID="recorder-premium-locked">
        <Text style={styles.lockedTitle}>Recording is a Premium feature</Text>
        <Text style={styles.lockedBody}>
          Photos, videos, and sound clips are available on the Premium plan. You can
          upgrade any time from your permissions screen — or describe what you've noticed
          in your own words instead.
        </Text>
        <PrimaryButton
          label="Describe it in words instead"
          onPress={() => navigation.replace('Questionnaire')}
          testID="locked-describe-button"
        />
        <PrimaryButton
          label="Back"
          variant="quiet"
          onPress={() => navigation.goBack()}
          testID="locked-back-button"
        />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedBody}>{loadError}</Text>
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
      <Text style={styles.heading}>Add a photo, video, or sound clip</Text>
      <Text style={styles.subheading}>
        A short everyday moment — playing, chatting, a mealtime — saved securely for your
        family. Nothing is shared or looked at without your permission.
      </Text>

      {/* Persistent consent reminder (CLAUDE.md §2 rule 9): calm and always visible,
          reusing the existing toggle so switching it off here is the same real consent
          change as in the Consent Center — not a look-alike. */}
      <View style={styles.reminderCard} testID="media-consent-reminder">
        <Text style={styles.reminderTitle}>Recording is always your choice</Text>
        <Text style={styles.reminderBody}>
          You can turn this off any time. Anything you save is encrypted, kept for 90
          days, and you can delete it whenever you like.
        </Text>
      </View>
      <ConsentToggle
        scope="media_capture"
        value={consentGranted}
        onChange={handleConsentToggle}
        disabled={pendingConsent}
      />

      <View style={styles.captureGroup}>
        <PrimaryButton
          label="Take a photo"
          onPress={() => captureWithCamera('photo')}
          disabled={!canCapture}
          loading={busyKind === 'photo'}
          testID="capture-photo-button"
        />
        <PrimaryButton
          label="Record a video"
          onPress={() => captureWithCamera('video')}
          disabled={!canCapture}
          loading={busyKind === 'video'}
          testID="capture-video-button"
        />
        <PrimaryButton
          label={recordingAudio ? 'Stop and save sound clip' : 'Record a sound clip'}
          onPress={toggleAudioRecording}
          disabled={(!canCapture && !recordingAudio) || busyKind === 'audio'}
          loading={busyKind === 'audio'}
          testID="capture-audio-button"
        />
        {!consentGranted && (
          <Text style={styles.consentHint} testID="capture-consent-hint">
            Turn on the switch above to start recording.
          </Text>
        )}
      </View>

      {saved.length > 0 && (
        <View style={styles.savedCard} testID="saved-media-list">
          {saved.map((asset) => (
            <Text key={asset.id} style={styles.savedRow}>
              {KIND_SAVED_LABEL[asset.kind]} — kept until{' '}
              {new Date(asset.retentionExpiresAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          ))}
        </View>
      )}

      {captureError && (
        <Text style={styles.errorText} testID="capture-error">
          {captureError}
        </Text>
      )}

      <View style={styles.actions}>
        {/* Never a dead end: declining media capture must leave a written path open —
            the questionnaire's note box / "Other — type it" answers. */}
        <PrimaryButton
          label="Skip — I'll describe instead"
          variant="quiet"
          onPress={() => navigation.replace('Questionnaire')}
          testID="skip-describe-button"
        />
        <PrimaryButton
          label="Done"
          variant="quiet"
          onPress={() => navigation.goBack()}
          testID="recorder-done-button"
        />
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
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  heading: { ...type.title, color: colors.ink },
  subheading: { ...type.body, color: colors.inkSoft },
  reminderCard: {
    backgroundColor: colors.primaryTint,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  reminderTitle: {
    ...type.bodyStrong,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  reminderBody: { ...type.caption, color: colors.inkSoft },
  captureGroup: { gap: spacing.sm },
  consentHint: {
    ...type.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  savedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    ...cardShadow,
  },
  savedRow: { ...type.caption, color: colors.ink },
  errorText: { ...type.caption, color: colors.inkSoft, textAlign: 'center' },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  lockedTitle: { ...type.bodyStrong, color: colors.ink, textAlign: 'center' },
  lockedBody: {
    ...type.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
