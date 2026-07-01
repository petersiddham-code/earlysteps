import { render, screen, fireEvent } from '@testing-library/react-native';
import { ComingSoonScreen } from './ComingSoonScreen';
import { useSession } from '../../session/index.js';

jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
    typeof ComingSoonScreen
  >[0]['navigation'];
}

describe('ComingSoonScreen', () => {
  it('shows the persisted family and child ids', () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      reset: jest.fn(),
    });
    render(<ComingSoonScreen navigation={navProp()} route={{} as never} />);
    expect(screen.getByText('Family: f1')).toBeTruthy();
    expect(screen.getByText('Child: c1')).toBeTruthy();
  });

  it('"Start over" clears the session and routes back to Splash', async () => {
    const reset = jest.fn().mockResolvedValue(undefined);
    (useSession as jest.Mock).mockReturnValue({ familyId: 'f1', childId: 'c1', reset });
    const navigation = navProp();
    render(<ComingSoonScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(screen.getByText('Start over'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reset).toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith('Splash');
  });
});
