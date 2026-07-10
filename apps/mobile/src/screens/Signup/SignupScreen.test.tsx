import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SignupScreen } from './SignupScreen';
import { register } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({ register: jest.fn() }));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return {
    navigate: jest.fn(),
    reset: jest.fn(),
  } as unknown as Parameters<typeof SignupScreen>[0]['navigation'];
}

describe('SignupScreen', () => {
  const setAccessToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ setAccessToken });
  });

  it('disables the submit button until both fields are filled', () => {
    const navigation = navProp();
    render(<SignupScreen navigation={navigation} route={{} as never} />);

    expect(screen.getByTestId('signup-submit-button').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('registers, stores the access token, and resets to Splash on success', async () => {
    (register as jest.Mock).mockResolvedValue({
      user: { id: 'u1', username: 'alex', tier: 'free', created_at: '2026-01-01' },
      access_token: 't1',
    });
    const navigation = navProp();
    render(<SignupScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(screen.getByTestId('signup-username-input'), 'alex');
    fireEvent.changeText(screen.getByTestId('signup-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-submit-button'));

    await waitFor(() => expect(register).toHaveBeenCalledWith('alex', 'password123'));
    await waitFor(() => expect(setAccessToken).toHaveBeenCalledWith('t1'));
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Splash' }],
    });
  });

  it('shows the backend message when the username is taken, without navigating', async () => {
    (register as jest.Mock).mockRejectedValue(
      new ApiError(409, { message: 'That username is already taken.' }),
    );
    const navigation = navProp();
    render(<SignupScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(screen.getByTestId('signup-username-input'), 'alex');
    fireEvent.changeText(screen.getByTestId('signup-password-input'), 'password123');
    fireEvent.press(screen.getByTestId('signup-submit-button'));

    expect(await screen.findByText('That username is already taken.')).toBeTruthy();
    expect(setAccessToken).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('navigates to Login via the link', () => {
    const navigation = navProp();
    render(<SignupScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(screen.getByTestId('signup-go-to-login'));

    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
