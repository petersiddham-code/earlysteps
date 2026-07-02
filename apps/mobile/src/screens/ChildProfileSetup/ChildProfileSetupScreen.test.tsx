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

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Birth month/year of a child exactly `months` old now (month granularity). */
function bornMonthsAgo(months: number): { month: number; year: number } {
  const now = new Date();
  const total = now.getFullYear() * 12 + now.getMonth() - months;
  return { month: (total % 12) + 1, year: Math.floor(total / 12) };
}

/** Fill in the birth month + year for a child exactly `months` old. */
function enterBirthDate(months: number): { month: number; year: number } {
  const born = bornMonthsAgo(months);
  fireEvent.press(screen.getByText(MONTH_LABELS[born.month - 1]!));
  fireEvent.changeText(screen.getByLabelText('Year of birth'), String(born.year));
  return born;
}

const CHILD = {
  id: 'c1',
  family_id: 'f1',
  nickname: 'Alex',
  birth_month: 6,
  birth_year: 2024,
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

  it('offers no manual age-band picker — the band is derived from the birth date (#25)', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    expect(screen.queryByText('How old are they?')).toBeNull();
    expect(screen.getByText('When were they born?')).toBeTruthy();
  });

  it('disables Continue until nickname, a valid birth date, and a language are set', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    const disabled = () =>
      screen.getByTestId('continue-button').props.accessibilityState.disabled;

    expect(disabled()).toBe(true);
    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    expect(disabled()).toBe(true);
    enterBirthDate(24);
    expect(disabled()).toBe(true);
    fireEvent.press(screen.getByText('English'));
    expect(disabled()).toBe(false);
  });

  it('shows the derived age band back as reassurance once month + year are in', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    expect(screen.queryByTestId('derived-band')).toBeNull();

    enterBirthDate(24); // 24 months old — toddler
    expect(screen.getByTestId('derived-band')).toBeTruthy();
    expect(screen.getByText(/Toddler \(12–36 months\) range/)).toBeTruthy();
  });

  it('derives the band from the actual age, not a coarse year difference', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    enterBirthDate(40); // 40 months old — preschool, though a year diff might say toddler
    expect(screen.getByText(/Preschool \(3–5 years\) range/)).toBeTruthy();
  });

  it('explains the supported age range for an out-of-range birth date and blocks Continue', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    fireEvent.press(screen.getByText('English'));

    enterBirthDate(6); // 6 months old — younger than the supported range
    expect(screen.getByTestId('age-range-notice')).toBeTruthy();
    expect(screen.getByText(/12 months to 25 years/)).toBeTruthy();
    expect(screen.getByTestId('continue-button').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('submits birth month/year (no age_band) and navigates on success', async () => {
    (createChild as jest.Mock).mockResolvedValue(CHILD);
    const navigation = navProp();
    render(<ChildProfileSetupScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    const born = enterBirthDate(24);
    fireEvent.press(screen.getByText('English'));
    fireEvent.press(screen.getByTestId('continue-button'));

    await waitFor(() =>
      expect(createChild).toHaveBeenCalledWith('f1', {
        nickname: 'Alex',
        birth_month: born.month,
        birth_year: born.year,
        languages: ['English'],
      }),
    );
    expect(setChildId).toHaveBeenCalledWith('c1');
    expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
  });

  it('gender is optional: skipping it entirely still submits, with no gender field sent', async () => {
    (createChild as jest.Mock).mockResolvedValue(CHILD);
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    enterBirthDate(24);
    fireEvent.press(screen.getByText('English'));
    fireEvent.press(screen.getByTestId('continue-button'));

    await waitFor(() => expect(createChild).toHaveBeenCalled());
    const [, payload] = (createChild as jest.Mock).mock.calls[0];
    expect(payload).not.toHaveProperty('gender');
    expect(payload).not.toHaveProperty('gender_detail');
  });

  it('sends the chosen gender, and tapping it again deselects (never a one-way choice)', async () => {
    (createChild as jest.Mock).mockResolvedValue(CHILD);
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    enterBirthDate(24);
    fireEvent.press(screen.getByText('English'));

    fireEvent.press(screen.getByText('Girl'));
    expect(
      screen.getByRole('button', { name: 'Girl' }).props.accessibilityState.selected,
    ).toBe(true);
    fireEvent.press(screen.getByText('Girl')); // deselect again
    fireEvent.press(screen.getByText('Boy'));

    fireEvent.press(screen.getByTestId('continue-button'));
    await waitFor(() => expect(createChild).toHaveBeenCalled());
    const [, payload] = (createChild as jest.Mock).mock.calls[0];
    expect(payload.gender).toBe('boy');
  });

  it("offers self-describe with the caregiver's own words riding along", async () => {
    (createChild as jest.Mock).mockResolvedValue(CHILD);
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    enterBirthDate(24);
    fireEvent.press(screen.getByText('English'));

    // The free-text box only appears for self-describe.
    expect(screen.queryByLabelText(/own words/)).toBeNull();
    fireEvent.press(screen.getByText('Prefer to self-describe'));
    fireEvent.changeText(
      screen.getByLabelText('Describe their gender in your own words'),
      'nonbinary',
    );

    fireEvent.press(screen.getByTestId('continue-button'));
    await waitFor(() => expect(createChild).toHaveBeenCalled());
    const [, payload] = (createChild as jest.Mock).mock.calls[0];
    expect(payload.gender).toBe('self_describe');
    expect(payload.gender_detail).toBe('nonbinary');
  });

  it('toggling a language chip twice removes it again', () => {
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);
    fireEvent.press(screen.getByText('Spanish'));
    fireEvent.press(screen.getByText('Spanish'));
    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    enterBirthDate(24);
    // No language selected (toggled on then off) — Continue should still be disabled.
    expect(screen.getByTestId('continue-button').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('shows a retryable error state when child creation fails', async () => {
    (createChild as jest.Mock).mockRejectedValue(new Error('network down'));
    render(<ChildProfileSetupScreen navigation={navProp()} route={{} as never} />);

    fireEvent.changeText(screen.getByPlaceholderText('Nickname'), 'Alex');
    enterBirthDate(24);
    fireEvent.press(screen.getByText('English'));
    fireEvent.press(screen.getByTestId('continue-button'));

    expect(await screen.findByText(/couldn't save that/i)).toBeTruthy();
  });
});
