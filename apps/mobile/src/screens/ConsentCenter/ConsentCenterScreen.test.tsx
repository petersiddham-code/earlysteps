import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ConsentCenterScreen } from './ConsentCenterScreen';
import { createFamily, updateConsent } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import { CONSENT_COPY } from '@earlysteps/content';

jest.mock('../../api/index.js', () => ({
  createFamily: jest.fn(),
  updateConsent: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
    typeof ConsentCenterScreen
  >[0]['navigation'];
}

const FAMILY = { id: 'f1', locale: 'en', low_bandwidth_mode: false, consent_flags: {} };

describe('ConsentCenterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ familyId: null, setFamilyId: jest.fn() });
  });

  it('creates a family on mount when there is no familyId yet', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() => expect(createFamily).toHaveBeenCalledWith({ locale: 'en' }));
    expect(await screen.findByText(CONSENT_COPY.scopes.data_storage.label)).toBeTruthy();
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
    (updateConsent as jest.Mock).mockResolvedValue({
      ...FAMILY,
      consent_flags: { data_storage: true },
    });
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    const switches = screen.getAllByRole('switch');
    fireEvent(switches[0]!, 'valueChange', true);

    await waitFor(() =>
      expect(updateConsent).toHaveBeenCalledWith('f1', 'data_storage', true),
    );
  });

  it('navigates to ChildProfileSetup on Continue regardless of what was granted', async () => {
    (createFamily as jest.Mock).mockResolvedValue(FAMILY);
    const navigation = navProp();
    render(<ConsentCenterScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(CONSENT_COPY.scopes.data_storage.label);

    fireEvent.press(screen.getByText('Continue'));
    expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup');
  });

  it('shows a retryable error state when family creation fails', async () => {
    (createFamily as jest.Mock).mockRejectedValue(new Error('network down'));
    render(<ConsentCenterScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/couldn't start your session/i)).toBeTruthy();
  });
});
