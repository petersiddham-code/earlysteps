import { render, waitFor } from '@testing-library/react-native';
import { SplashScreen } from './SplashScreen';
import { useSession } from '../../session/index.js';
import { getChildren } from '../../api/index.js';

jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));
jest.mock('../../api/index.js', () => ({ getChildren: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
    typeof SplashScreen
  >[0]['navigation'];
}

describe('SplashScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('routes to Login when there is no access token and no guest session (#97)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: null,
      isGuest: false,
      familyId: null,
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Login'));
  });

  it('bypasses Login for a guest session even without an access token (#99)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: null,
      isGuest: true,
      familyId: null,
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ConsentCenter'));
  });

  it('routes to ConsentCenter when logged in but there is no family yet', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: 't1',
      familyId: null,
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ConsentCenter'));
  });

  it('routes a guest with a family but no child straight to ChildProfileSetup, without checking for recoverable children', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: null,
      isGuest: true,
      familyId: 'f1',
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup'),
    );
    expect(getChildren).not.toHaveBeenCalled();
  });

  it('routes a logged-in family with no recorded children to ChildProfileSetup (first child ever, #23)', async () => {
    (getChildren as jest.Mock).mockResolvedValue([]);
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: 't1',
      isGuest: false,
      familyId: 'f1',
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup'),
    );
  });

  it('routes a logged-in family that already has children (recovered on a new device) to ChildSwitcher instead of creating a duplicate (#23)', async () => {
    (getChildren as jest.Mock).mockResolvedValue([{ id: 'c1', nickname: 'Alex' }]);
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: 't1',
      isGuest: false,
      familyId: 'f1',
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ChildSwitcher'));
  });

  it('falls back to ChildProfileSetup if the recovery lookup fails', async () => {
    (getChildren as jest.Mock).mockRejectedValue(new Error('offline'));
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: 't1',
      isGuest: false,
      familyId: 'f1',
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup'),
    );
  });

  it('routes straight to Results once logged in with both a family and a child', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      accessToken: 't1',
      familyId: 'f1',
      childId: 'c1',
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('does not navigate while the session is still loading', () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: true,
      accessToken: null,
      familyId: null,
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
