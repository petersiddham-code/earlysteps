import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { LogoutButton } from './LogoutButton';
import { useSession } from '../../session/index.js';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({
  ...jest.requireActual('../../session/index.js'),
  useSession: jest.fn(),
}));

describe('LogoutButton', () => {
  const reset = jest.fn().mockResolvedValue(undefined);
  const navigationReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    reset.mockResolvedValue(undefined);
    (useSession as jest.Mock).mockReturnValue({ reset });
    (useNavigation as jest.Mock).mockReturnValue({ reset: navigationReset });
  });

  it('forgets the whole session, then resets the nav stack to Splash (issue #121)', async () => {
    render(<LogoutButton />);

    fireEvent.press(screen.getByTestId('logout-button'));

    // reset() must run before the nav stack is torn down — same ordering the
    // existing Login/ConsentCenter "delete everything" flows already rely on.
    await waitFor(() =>
      expect(navigationReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Splash' }],
      }),
    );
    expect(reset).toHaveBeenCalled();
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
      navigationReset.mock.invocationCallOrder[0],
    );
  });

  it('is announced as a "Log out" button for screen readers', () => {
    render(<LogoutButton />);
    expect(screen.getByLabelText('Log out')).toBeTruthy();
  });
});
