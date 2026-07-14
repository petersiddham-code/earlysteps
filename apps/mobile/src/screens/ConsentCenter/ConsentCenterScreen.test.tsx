import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentCenterScreen } from './ConsentCenterScreen';
import {
  createFamily,
  deleteFamily,
  getChild,
  getFamily,
  updateConsent,
  upgradeTier,
} from '../../api/index.js';
import { useSession } from '../../session/index.js';
import { CONSENT_COPY } from '@earlysteps/content';

jest.mock('../../api/index.js', () => ({
  createFamily: jest.fn(),
  deleteFamily: jest.fn(),
  getChild: jest.fn(),
  getFamily: jest.fn(),
  updateConsent: jest.fn(),
  upgradeTier: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp(canGoBack = false) {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn(() => canGoBack),
  } as unknown as Parameters<typeof ConsentCenterScreen>[0]['navigation'];
}

const FAMILY = { id: 'f1', locale: 'en', low_bandwidth_mode: false, consent_flags: {} };
const CONSENTED_FAMILY = { ...FAMILY, consent_flags: { data_storage: true } };
const CHILD = {
  id: 'c1',
  family_id: 'f1',
  nickname: 'Sam',
  birth_month: 6,
  birth_year: 2022,
  age_band: 'toddler',
  languages: ['English'],
};

describe('ConsentCenterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      familyId: null,
      childId: null,
      setFamilyId: jest.fn(),
    });
    (getChild as jest.Mock).mockResolvedValue(CHILD);
  });

  it('creates a family on mount when there is no familyId yet', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() => expect(createFamily).toHaveBeenCalledWith({ locale: 'en' }));
    expect(await screen.findByText(CONSENT_COPY.scopes.data_storage.label)).toBeTruthy();
  });

  it('loads the existing family instead of creating one on a revisit', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      setFamilyId: jest.fn(),
    });
    (getFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(CONSENT_COPY.scopes.data_storage.label)).toBeTruthy();
    expect(getFamily).toHaveBeenCalledWith('f1');
    expect(createFamily).not.toHaveBeenCalled();
  });

  it('names the child in the consent copy on a revisit — no raw [child] placeholder (#36)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      setFamilyId: jest.fn(),
    });
    (getFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/Sam's profile/)).toBeTruthy();
    expect(screen.queryByText(/\[child\]/)).toBeNull();
    expect(getChild).toHaveBeenCalledWith('f1', 'c1');
  });

  it('reads "your child" during onboarding, before any child profile exists (#36)', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/your child's profile/)).toBeTruthy();
    expect(screen.queryByText(/\[child\]/)).toBeNull();
    expect(getChild).not.toHaveBeenCalled();
  });

  it('renders all four consent scopes once the family is created', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    for (const scope of Object.keys(
      CONSENT_COPY.scopes,
    ) as (keyof typeof CONSENT_COPY.scopes)[]) {
      expect(await screen.findByText(CONSENT_COPY.scopes[scope].label)).toBeTruthy();
    }
  });

  it('calls updateConsent for exactly the toggled scope when a switch flips', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    (updateConsent as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    const switches = screen.getAllByRole('switch');
    fireEvent(switches[0]!, 'valueChange', true);

    await waitFor(() =>
      expect(updateConsent).toHaveBeenCalledWith('f1', 'data_storage', true),
    );
  });

  it('never blocks Continue on data_storage — declining it means guest mode, not a dead end (#63)', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    const navigation = navProp();
    render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    expect(
      screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled,
    ).toBe(false);
    fireEvent.press(screen.getByText('Continue'));
    expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup');
  });

  it('navigates to ChildProfileSetup on Continue once data_storage is granted', async () => {
    (createFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
    const navigation = navProp();
    render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    fireEvent.press(screen.getByText('Continue'));
    expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup');
  });

  it('navigates to Questionnaire on Continue when a child already exists', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      setFamilyId: jest.fn(),
    });
    (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
    const navigation = navProp();
    render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    fireEvent.press(screen.getByText('Continue'));
    expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
  });

  it('pops back on Continue when pushed on top of another screen (answers preserved)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      setFamilyId: jest.fn(),
    });
    (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
    const navigation = navProp(true);
    render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    fireEvent.press(screen.getByText('Continue'));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('shows a retryable error state when family creation fails', async () => {
    (createFamily as jest.Mock).mockRejectedValue(new Error('network down'));
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/couldn't start your session/i)).toBeTruthy();
  });

  it('actually refetches when Try again is pressed after a failure', async () => {
    (createFamily as jest.Mock)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/couldn't start your session/i);

    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByText(CONSENT_COPY.scopes.data_storage.label)).toBeTruthy();
    expect(createFamily).toHaveBeenCalledTimes(2);
  });
  describe('delete everything (issue #55)', () => {
    function sessionWithReset() {
      const reset = jest.fn().mockResolvedValue(undefined);
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        reset,
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      return reset;
    }

    it('first tap only reveals the confirmation — nothing is deleted yet', async () => {
      sessionWithReset();
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByTestId('delete-everything-button');

      fireEvent.press(screen.getByTestId('delete-everything-button'));

      expect(screen.getByTestId('delete-confirm-block')).toBeTruthy();
      expect(deleteFamily).not.toHaveBeenCalled();
    });

    it('confirming deletes server-side, forgets the session, and restarts at Splash', async () => {
      const reset = sessionWithReset();
      (deleteFamily as jest.Mock).mockResolvedValue(undefined);
      const navigation = navProp();
      render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
      await screen.findByTestId('delete-everything-button');

      fireEvent.press(screen.getByTestId('delete-everything-button'));
      fireEvent.press(screen.getByTestId('confirm-delete-button'));

      await waitFor(() => expect(deleteFamily).toHaveBeenCalledWith('f1'));
      await waitFor(() => expect(reset).toHaveBeenCalled());
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Splash' }],
      });
    });

    it('"Keep my data" backs out without deleting anything', async () => {
      sessionWithReset();
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByTestId('delete-everything-button');

      fireEvent.press(screen.getByTestId('delete-everything-button'));
      fireEvent.press(screen.getByTestId('cancel-delete-button'));

      expect(screen.queryByTestId('delete-confirm-block')).toBeNull();
      expect(deleteFamily).not.toHaveBeenCalled();
    });

    it('a failed delete shows a retryable error and keeps the local session', async () => {
      const reset = sessionWithReset();
      (deleteFamily as jest.Mock).mockRejectedValue(new Error('network down'));
      const navigation = navProp();
      render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
      await screen.findByTestId('delete-everything-button');

      fireEvent.press(screen.getByTestId('delete-everything-button'));
      fireEvent.press(screen.getByTestId('confirm-delete-button'));

      expect(await screen.findByText(/couldn't delete your data/i)).toBeTruthy();
      expect(reset).not.toHaveBeenCalled();
      expect(navigation.reset).not.toHaveBeenCalled();
    });
  });

  describe('guest session (issue #99)', () => {
    beforeEach(() => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: null,
        childId: null,
        setFamilyId: jest.fn(),
        isGuest: true,
        tier: null,
      });
      (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    });

    it('hides all four consent scopes for a guest (issue #123)', async () => {
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByTestId('consent-guest-banner');

      expect(screen.queryByText(CONSENT_COPY.scopes.data_storage.label)).toBeNull();
      expect(screen.queryByText(CONSENT_COPY.scopes.ai_analysis.label)).toBeNull();
      expect(screen.queryByText(CONSENT_COPY.scopes.media_capture.label)).toBeNull();
      expect(
        screen.queryByText(CONSENT_COPY.scopes.professional_sharing.label),
      ).toBeNull();
      expect(screen.queryAllByRole('switch')).toHaveLength(0);
    });

    it('hides "Delete everything" — a guest has nothing saved to delete', async () => {
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByTestId('consent-guest-banner');

      expect(screen.queryByTestId('delete-everything-button')).toBeNull();
    });

    it('hides the plan section — a guest has no account to upgrade', async () => {
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByTestId('consent-guest-banner');

      expect(screen.queryByTestId('consent-plan-section')).toBeNull();
    });

    it('the login link navigates to Login', async () => {
      const navigation = navProp();
      render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
      await screen.findByTestId('consent-guest-banner');

      fireEvent.press(screen.getByTestId('consent-guest-login-link'));

      expect(navigation.navigate).toHaveBeenCalledWith('Login');
    });
  });

  describe('plan / upgrade (issue #99)', () => {
    it('shows an Upgrade button for a logged-in free-tier account', async () => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        isGuest: false,
        tier: 'free',
        setTier: jest.fn(),
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

      expect(await screen.findByTestId('upgrade-to-premium-button')).toBeTruthy();
    });

    it('upgrading calls the API and updates the session tier, without an Upgrade button afterwards', async () => {
      const setTier = jest.fn().mockResolvedValue(undefined);
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        isGuest: false,
        tier: 'free',
        setTier,
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      (upgradeTier as jest.Mock).mockResolvedValue({
        id: 'u1',
        username: 'alex',
        tier: 'premium',
        created_at: '2026-01-01',
      });
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      fireEvent.press(await screen.findByTestId('upgrade-to-premium-button'));

      await waitFor(() => expect(setTier).toHaveBeenCalledWith('premium'));
    });

    it('shows Premium without an Upgrade button for an already-premium account', async () => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        isGuest: false,
        tier: 'premium',
        setTier: jest.fn(),
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

      expect(await screen.findByTestId('consent-plan-section')).toBeTruthy();
      expect(screen.queryByTestId('upgrade-to-premium-button')).toBeNull();
    });
  });

  describe('media_capture premium gating (issue #123)', () => {
    it('disables media_capture (but keeps it visible) for a logged-in free-tier account', async () => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        isGuest: false,
        tier: 'free',
        setTier: jest.fn(),
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByText(CONSENT_COPY.scopes.media_capture.label);

      expect(screen.getByText('Available on Premium')).toBeTruthy();
      const switches = screen.getAllByRole('switch');
      // CONSENT_SCOPES order: data_storage, ai_analysis, media_capture, professional_sharing.
      expect(switches[2]!.props.disabled).toBe(true);
      expect(switches[0]!.props.disabled).toBeFalsy();
      expect(switches[3]!.props.disabled).toBeFalsy();
    });

    it('does not call updateConsent when the disabled media_capture switch is toggled anyway', async () => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        isGuest: false,
        tier: 'free',
        setTier: jest.fn(),
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByText(CONSENT_COPY.scopes.media_capture.label);

      const switches = screen.getAllByRole('switch');
      fireEvent(switches[2]!, 'valueChange', true);

      expect(updateConsent).not.toHaveBeenCalled();
    });

    it('enables media_capture for a premium account, with no "Available on Premium" reason', async () => {
      (useSession as jest.Mock).mockReturnValue({
        familyId: 'f1',
        childId: 'c1',
        setFamilyId: jest.fn(),
        isGuest: false,
        tier: 'premium',
        setTier: jest.fn(),
      });
      (getFamily as jest.Mock).mockResolvedValue(CONSENTED_FAMILY);
      render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
      await screen.findByText(CONSENT_COPY.scopes.media_capture.label);

      expect(screen.queryByText('Available on Premium')).toBeNull();
      const switches = screen.getAllByRole('switch');
      expect(switches[2]!.props.disabled).toBeFalsy();
    });
  });
});
