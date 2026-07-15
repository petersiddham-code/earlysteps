import { render, screen, fireEvent } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminConsoleButton } from './AdminConsoleButton';
import { useSession } from '../../session/index.js';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({
  ...jest.requireActual('../../session/index.js'),
  useSession: jest.fn(),
}));

describe('AdminConsoleButton (#125)', () => {
  const navigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({ navigate });
  });

  it('renders nothing for a parent account', () => {
    (useSession as jest.Mock).mockReturnValue({ isGuest: false, role: 'parent' });
    render(<AdminConsoleButton />);
    expect(screen.queryByTestId('admin-console-button')).toBeNull();
  });

  it('renders nothing for a guest session, even with role somehow set', () => {
    (useSession as jest.Mock).mockReturnValue({ isGuest: true, role: 'admin' });
    render(<AdminConsoleButton />);
    expect(screen.queryByTestId('admin-console-button')).toBeNull();
  });

  it('renders and navigates to AdminDashboard for an admin account', () => {
    (useSession as jest.Mock).mockReturnValue({ isGuest: false, role: 'admin' });
    render(<AdminConsoleButton />);

    const button = screen.getByTestId('admin-console-button');
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(navigate).toHaveBeenCalledWith('AdminDashboard');
  });
});
