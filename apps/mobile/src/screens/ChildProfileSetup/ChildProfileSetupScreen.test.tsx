import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ChildProfileSetupScreen } from './ChildProfileSetupScreen';
import { createChild } from '../../api/index.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({ createChild: jest.fn() }));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
    typeof ChildProfileSetupScreen
  >[0]['navigation'];
}

const CHILD = {
  id: 'c1',
  family_id: 'f1',
  nickname: 'Alex',
  age_band: 'toddler',
  languages: ['English'],
};

describe('ChildProfileSetupScreen', () => {
  let setChildId: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    setChildId = jest.fn().mockResolvedValue(undefined);
    (useSession as jest.Mock).mockReturnValue({ familyId: 'f1', setChildId });
  });

  it('disables Continue until nickname, age band, and at least one language are set', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    expect(screen.getByTestId('continue-button').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('enables Continue once the form is filled in, and submits the right payload', async () => {
    (createChild as jest.Mock).mockResolvedValue(CHILD);
    const navigation = navProp();
    render(<ChildProfileSetupScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    fireEvent.press(screen.getByText('Toddler (12–36 months)'));
    fireEvent.press(screen.getByText('English'));

    expect(screen.getByTestId('continue-button').props.accessibilityState.disabled).toBe(
      false,
    );
    fireEvent.press(screen.getByTestId('continue-button'));

    await waitFor(() =>
      expect(createChild).toHaveBeenCalledWith('f1', {
        nickname: 'Alex',
        age_band: 'toddler',
        languages: ['English'],
      }),
    );
    expect(setChildId).toHaveBeenCalledWith('c1');
    expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
  });

  it('toggling a language chip twice removes it again', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    fireEvent.press(screen.getByText('Spanish'));
    fireEvent.press(screen.getByText('Spanish'));
    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    fireEvent.press(screen.getByText('Toddler (12–36 months)'));
    // No language selected (toggled on then off) — Continue should still be disabled.
    expect(screen.getByTestId('continue-button').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('shows a retryable error state when child creation fails', async () => {
    (createChild as jest.Mock).mockRejectedValue(new Error('network down'));
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    fireEvent.press(screen.getByText('Toddler (12–36 months)'));
    fireEvent.press(screen.getByText('English'));
    fireEvent.press(screen.getByTestId('continue-button'));

    expect(await screen.findByText(/couldn't save that/i)).toBeTruthy();
  });
});
