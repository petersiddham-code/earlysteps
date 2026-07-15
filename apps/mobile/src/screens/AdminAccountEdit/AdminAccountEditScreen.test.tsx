import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdminAccountEditScreen } from './AdminAccountEditScreen';
import { ApiError } from '../../api/client.js';
import { updateAdminAccount } from '../../api/index.js';

jest.mock('../../api/index.js', () => ({ updateAdminAccount: jest.fn() }));

function navProp() {
  return { goBack: jest.fn() } as unknown as Parameters<
    typeof AdminAccountEditScreen
  >[0]['navigation'];
}

const ACCOUNT = {
  id: 'u1',
  username: 'a-parent',
  tier: 'free' as const,
  role: 'parent' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  family_count: 1,
  child_count: 2,
};

function routeProp(account = ACCOUNT) {
  return { params: { account } } as unknown as Parameters<
    typeof AdminAccountEditScreen
  >[0]['route'];
}

describe('AdminAccountEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pre-fills the account's current username, tier, and role", () => {
    render(<AdminAccountEditScreen navigation={navProp()} route={routeProp()} />);

    expect(screen.getByDisplayValue('a-parent')).toBeTruthy();
  });

  it('saves the edited fields and navigates back on success', async () => {
    (updateAdminAccount as jest.Mock).mockResolvedValue({ ...ACCOUNT, tier: 'premium' });
    const navigation = navProp();
    render(<AdminAccountEditScreen navigation={navigation} route={routeProp()} />);

    fireEvent.press(screen.getByTestId('admin-account-edit-tier-premium'));
    fireEvent.press(screen.getByTestId('admin-account-edit-save'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(updateAdminAccount).toHaveBeenCalledWith('u1', {
      username: 'a-parent',
      tier: 'premium',
      role: 'parent',
    });
  });

  it('shows the server error and does not navigate back on failure (e.g. self-demotion guard)', async () => {
    (updateAdminAccount as jest.Mock).mockRejectedValue(
      new ApiError(400, { message: 'You cannot change your own role away from admin.' }),
    );
    const navigation = navProp();
    render(<AdminAccountEditScreen navigation={navigation} route={routeProp()} />);

    fireEvent.press(screen.getByTestId('admin-account-edit-role-parent'));
    fireEvent.press(screen.getByTestId('admin-account-edit-save'));

    await waitFor(() =>
      expect(
        screen.getByText('You cannot change your own role away from admin.'),
      ).toBeTruthy(),
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
