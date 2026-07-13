import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ChildSwitcherScreen } from './ChildSwitcherScreen';
import { getChildren } from '../../api/index.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({ getChildren: jest.fn() }));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
  } as unknown as Parameters<typeof ChildSwitcherScreen>[0]['navigation'];
}

const CHILD_A = {
  id: 'c1',
  family_id: 'f1',
  nickname: 'Alex',
  birth_month: 6,
  birth_year: 2022,
  age_band: 'toddler',
  languages: ['English'],
};
const CHILD_B = {
  id: 'c2',
  family_id: 'f1',
  nickname: 'Sam',
  birth_month: 1,
  birth_year: 2018,
  age_band: 'primary',
  languages: ['English'],
};

describe('ChildSwitcherScreen', () => {
  const setChildId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      setChildId,
    });
  });

  it('lists every child recorded under the family, marking the active one', async () => {
    (getChildren as jest.Mock).mockResolvedValue([CHILD_A, CHILD_B]);
    render(<ChildSwitcherScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('child-row-c1')).toBeTruthy());
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.getByTestId('child-row-c1').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('child-row-c2').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('switching to a different child sets the session childId and returns to Results', async () => {
    (getChildren as jest.Mock).mockResolvedValue([CHILD_A, CHILD_B]);
    const navigation = navProp();
    render(<ChildSwitcherScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(screen.getByTestId('child-row-c2')).toBeTruthy());
    fireEvent.press(screen.getByTestId('child-row-c2'));

    await waitFor(() => expect(setChildId).toHaveBeenCalledWith('c2'));
    expect(navigation.replace).toHaveBeenCalledWith('Results');
  });

  it('"Add another child" navigates to ChildProfileSetup without touching the current child', async () => {
    (getChildren as jest.Mock).mockResolvedValue([CHILD_A]);
    const navigation = navProp();
    render(<ChildSwitcherScreen navigation={navigation} route={{} as never} />);

    await waitFor(() =>
      expect(screen.getByTestId('add-another-child-button')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('add-another-child-button'));

    expect(navigation.navigate).toHaveBeenCalledWith('ChildProfileSetup');
    expect(setChildId).not.toHaveBeenCalled();
  });

  it('shows an error state when the children list fails to load', async () => {
    (getChildren as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<ChildSwitcherScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't load your children. Please try again."),
      ).toBeTruthy(),
    );
  });
});
