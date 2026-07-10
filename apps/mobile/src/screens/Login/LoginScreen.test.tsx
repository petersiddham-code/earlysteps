import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import { login } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({ login: jest.fn() }));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return {
    navigate: jest.fn(),
    reset: jest.fn(),
  } as unknown as Parameters<typeof LoginScreen>[0]['navigation'];
}

describe('LoginScreen', () => {
  const setAccessToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ setAccessToken });
  });

  it('disables the submit button until both fields are filled', () => {
    const navigation = navProp();
    render(<LoginScreen navigation={navigation} route={{} as never} />);

    expect(screen.getByTestId('login-submit-button').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('logs in, stores the access token, and resets to Splash on success', async () => {
    (login as jest.Mock).mockResolvedValue({
      user: { id: 'u1', username: 'alex', tier: 'free', created_at: '2026-01-01' },
      access_token: 't1',
    });
    const navigation = navProp();
    render(<LoginScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(screen.getByTestId('login-username-input'), 'alex');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('login-submit-button'));

    await waitFor(() => expect(login).toHaveBeenCalledWith('alex', 'password123'));
    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith('t1'));
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Splash' }],
    });
  });

  it('shows the backend message on incorrect credentials, without navigating', async () => {
    (login as jest.Mock).mockRejectedValue(
      new ApiError(401, { message: 'Incorrect username or password.' }),
    );
    const navigation = navProp();
    render(<LoginScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(screen.getByTestId('login-username-input'), 'alex');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'wrong');
    fireEvent.press(screen.getByTestId('login-submit-button'));

    expect(await screen.findByText('Incorrect username or password.')).toBeTruthy();
    expect(setAccessToken).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('navigates to Signup via the link', () => {
    const navigation = navProp();
    render(<LoginScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(screen.getByTestId('login-go-to-signup'));

    expect(navigation.navigate).toHaveBeenCalledWith('Signup');
  });
});
