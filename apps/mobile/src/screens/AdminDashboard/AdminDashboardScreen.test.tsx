import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdminDashboardScreen } from './AdminDashboardScreen';
import { getAdminAccounts } from '../../api/index.js';

jest.mock('../../api/index.js', () => ({ getAdminAccounts: jest.fn() }));

function navProp() {
  return {
    navigate: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  } as unknown as Parameters<typeof AdminDashboardScreen>[0]['navigation'];
}

const ACCOUNT_A = {
  id: 'u1',
  username: 'a-parent',
  tier: 'free',
  role: 'parent',
  created_at: '2026-01-01T00:00:00.000Z',
  family_count: 1,
  child_count: 2,
};
const ACCOUNT_B = {
  id: 'u2',
  username: 'an-admin',
  tier: 'premium',
  role: 'admin',
  created_at: '2026-01-02T00:00:00.000Z',
  family_count: 0,
  child_count: 0,
};

describe('AdminDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every account with tier/role/family/child counts', async () => {
    (getAdminAccounts as jest.Mock).mockResolvedValue([ACCOUNT_A, ACCOUNT_B]);
    render(<AdminDashboardScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('admin-account-row-u1')).toBeTruthy());
    expect(screen.getByText('a-parent')).toBeTruthy();
    expect(screen.getByText('an-admin')).toBeTruthy();
    expect(screen.getByTestId('admin-accounts-summary')).toHaveTextContent(
      '2 accounts · 1 premium',
    );
  });

  it('shows an error state when accounts fail to load', async () => {
    (getAdminAccounts as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<AdminDashboardScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't load accounts. Please try again."),
      ).toBeTruthy(),
    );
  });

  it('navigates to AdminAccountEdit with the tapped account on row press (issue #131)', async () => {
    (getAdminAccounts as jest.Mock).mockResolvedValue([ACCOUNT_A, ACCOUNT_B]);
    const navigation = navProp();
    render(<AdminDashboardScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('admin-account-row-u1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('admin-account-row-u1'));

    expect(navigation.navigate).toHaveBeenCalledWith('AdminAccountEdit', {
      account: ACCOUNT_A,
    });
  });

  it('re-fetches accounts when the screen regains focus (e.g. after an edit)', async () => {
    (getAdminAccounts as jest.Mock).mockResolvedValue([ACCOUNT_A]);
    const navigation = navProp();
    render(<AdminDashboardScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(getAdminAccounts).toHaveBeenCalled());
    expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));

    const focusHandler = (navigation.addListener as jest.Mock).mock.calls.find(
      ([event]) => event === 'focus',
    )?.[1];
    (getAdminAccounts as jest.Mock).mockResolvedValue([ACCOUNT_A, ACCOUNT_B]);
    focusHandler();

    await waitFor(() => expect(screen.getByTestId('admin-account-row-u2')).toBeTruthy());
  });
});
