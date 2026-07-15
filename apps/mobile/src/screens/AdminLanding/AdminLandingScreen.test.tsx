import { render, screen, fireEvent } from '@testing-library/react-native';
import { AdminLandingScreen } from './AdminLandingScreen';

function navProp() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
  } as unknown as Parameters<typeof AdminLandingScreen>[0]['navigation'];
}

describe('AdminLandingScreen (#125)', () => {
  it('"Open admin console" pushes AdminDashboard', () => {
    const navigation = navProp();
    render(<AdminLandingScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(screen.getByTestId('admin-landing-open-console'));
    expect(navigation.navigate).toHaveBeenCalledWith('AdminDashboard');
  });

  it('"Continue to app" replaces back to Splash with skipAdminChoice set', () => {
    const navigation = navProp();
    render(<AdminLandingScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(screen.getByTestId('admin-landing-continue-to-app'));
    expect(navigation.replace).toHaveBeenCalledWith('Splash', { skipAdminChoice: true });
  });
});
