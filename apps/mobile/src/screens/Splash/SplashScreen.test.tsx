import { render, waitFor } from '@testing-library/react-native';
import { SplashScreen } from './SplashScreen';
import { useSession } from '../../session/index.js';

jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
    typeof SplashScreen
  >[0]['navigation'];
}

describe('SplashScreen', () => {
  it('routes to ConsentCenter when there is no family yet', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      familyId: null,
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ConsentCenter'));
  });

  it('routes to ChildProfileSetup when there is a family but no child', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      familyId: 'f1',
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup'),
    );
  });

  it('routes onward once both a family and a child exist', async () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: false,
      familyId: 'f1',
      childId: 'c1',
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ComingSoon'));
  });

  it('does not navigate while the session is still loading', () => {
    (useSession as jest.Mock).mockReturnValue({
      isLoading: true,
      familyId: null,
      childId: null,
    });
    const navigation = navProp();
    render(<SplashScreen navigation={navigation} route={{} as never} />);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
