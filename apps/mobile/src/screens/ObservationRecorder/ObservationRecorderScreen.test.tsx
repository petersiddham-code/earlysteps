import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ObservationRecorderScreen } from './ObservationRecorderScreen';
import { getFamily, updateConsent, uploadMedia } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import { CONSENT_COPY } from '@earlysteps/content';
import * as ImagePicker from 'expo-image-picker';

jest.mock('../../api/index.js', () => ({
  getFamily: jest.fn(),
  updateConsent: jest.fn(),
  uploadMedia: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));
// Native module boundaries (camera/mic hardware can't run under jest) — mocked the same
// way the rest of the suite mocks native Expo modules, not re-implemented.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    uri: 'file://recording.m4a',
  })),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  RecordingPresets: { HIGH_QUALITY: {} },
}));

function navProp() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
  } as unknown as Parameters<typeof ObservationRecorderScreen>[0]['navigation'];
}

const FAMILY = { id: 'f1', locale: 'en', low_bandwidth_mode: false, consent_flags: {} };
const CONSENTED_FAMILY = { ...FAMILY, consent_flags: { media_capture: true } };
const UPLOADED_ASSET = {
  id: 'm1',
  childId: 'c1',
  kind: 'photo',
  mimeType: 'image/jpeg',
  capturedAt: '2026-07-16T00:00:00.000Z',
  retentionExpiresAt: '2026-10-14T00:00:00.000Z',
  retainedByParent: false,
  deletedAt: null,
};

function premiumSession() {
  (useSession as jest.Mock).mockReturnValue({
    familyId: 'f1',
    childId: 'c1',
    tier: 'premium',
    isGuest: false,
  });
}

describe('ObservationRecorderScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    premiumSession();
    (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
  });

  it('renders the calm consent reminder and the real media_capture toggle', async () => {
    render(<ObservationRecorderScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByTestId('media-consent-reminder')).toBeTruthy();
    expect(screen.getByText(CONSENT_COPY.scopes.media_capture.label)).toBeTruthy();
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('"Skip — I\'ll describe instead" routes into the questionnaire (free-text path)', async () => {
    const navigation = navProp();
    render(<ObservationRecorderScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('skip-describe-button');

    fireEvent.press(screen.getByTestId('skip-describe-button'));

    expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
  });

  it('disables all capture controls while media_capture consent is off', async () => {
    (getFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ObservationRecorderScreen navigation={navProp()} route={{} as never} />);
    await screen.findByTestId('capture-consent-hint');

    for (const id of [
      'capture-photo-button',
      'capture-video-button',
      'capture-audio-button',
    ]) {
      expect(screen.getByTestId(id).props.accessibilityState.disabled).toBe(true);
    }
  });

  it('flipping the toggle calls updateConsent for exactly the media_capture scope', async () => {
    (getFamily as jest.Mock).mockResolvedValue(FAMILY);
    (updateConsent as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
    render(<ObservationRecorderScreen navigation={navProp()} route={{} as never} />);
    await screen.findByRole('switch');

    fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() =>
      expect(updateConsent).toHaveBeenCalledWith('f1', 'media_capture', true),
    );
    // Controls unlock once the updated family comes back.
    await waitFor(() =>
      expect(
        screen.getByTestId('capture-photo-button').props.accessibilityState.disabled,
      ).toBe(false),
    );
  });

  it('a photo capture uploads the picked file and shows it as saved', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://photo.jpg', mimeType: 'image/jpeg' }],
    });
    (uploadMedia as jest.Mock).mockResolvedValue(UPLOADED_ASSET);
    render(<ObservationRecorderScreen navigation={navProp()} route={{} as never} />);
    await screen.findByTestId('capture-photo-button');

    fireEvent.press(screen.getByTestId('capture-photo-button'));

    await waitFor(() =>
      expect(uploadMedia).toHaveBeenCalledWith({
        childId: 'c1',
        kind: 'photo',
        fileUri: 'file://photo.jpg',
        mimeType: 'image/jpeg',
      }),
    );
    expect(await screen.findByTestId('saved-media-list')).toBeTruthy();
    expect(screen.getByText(/Photo saved/)).toBeTruthy();
  });

  it('uploads nothing when camera permission is declined, and says so calmly', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
    });
    render(<ObservationRecorderScreen navigation={navProp()} route={{} as never} />);
    await screen.findByTestId('capture-photo-button');

    fireEvent.press(screen.getByTestId('capture-photo-button'));

    expect(await screen.findByTestId('capture-error')).toBeTruthy();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  it('uploads nothing when the camera is cancelled mid-capture', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: true,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    render(<ObservationRecorderScreen navigation={navProp()} route={{} as never} />);
    await screen.findByTestId('capture-video-button');

    fireEvent.press(screen.getByTestId('capture-video-button'));

    await waitFor(() => expect(ImagePicker.launchCameraAsync).toHaveBeenCalled());
    expect(uploadMedia).not.toHaveBeenCalled();
  });

  describe('premium-tier gating (issue #123 backend counterpart)', () => {
    it('shows the locked state (no capture controls) for a free-tier session', async () => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        tier: 'free',
        isGuest: false,
      });
      const navigation = navProp();
      render(<ObservationRecorderScreen navigation={navigation} route={{} as never} />);

      expect(screen.getByTestId('recorder-premium-locked')).toBeTruthy();
      expect(screen.queryByTestId('capture-photo-button')).toBeNull();
      expect(getFamily).not.toHaveBeenCalled();

      // The written path stays open even from the locked state.
      fireEvent.press(screen.getByTestId('locked-describe-button'));
      expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
    });
  });
});
