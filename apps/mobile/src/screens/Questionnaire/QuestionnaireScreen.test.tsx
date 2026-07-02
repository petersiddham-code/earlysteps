import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QuestionnaireScreen } from './QuestionnaireScreen';
import { getChild, submitIntakeResponses } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({
  getChild: jest.fn(),
  submitIntakeResponses: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn(), navigate: jest.fn() } as unknown as Parameters<
    typeof QuestionnaireScreen
  >[0]['navigation'];
}

const CHILD = {
  id: 'c1',
  family_id: 'f1',
  nickname: 'Alex',
  age_band: 'toddler' as const,
  languages: ['English'],
};

/** Skip forward through the wizard until `matcher` is on screen (or fail loudly). */
function skipToQuestion(matcher: string | RegExp) {
  for (let i = 0; i < 60; i++) {
    if (screen.queryByText(matcher)) return;
    const skip = screen.queryByTestId('skip-button');
    if (!skip) throw new Error(`Reached the review step without finding ${matcher}`);
    fireEvent.press(skip);
  }
  throw new Error(`Question not found after 60 skips: ${matcher}`);
}

/** Skip forward until the review step's submit button is on screen. */
function skipToReview() {
  for (let i = 0; i < 60; i++) {
    if (screen.queryByTestId('submit-button')) return;
    fireEvent.press(screen.getByTestId('skip-button'));
  }
  throw new Error('Never reached the review step');
}

describe('QuestionnaireScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ familyId: 'f1', childId: 'c1' });
  });

  it('shows one question at a time with stepping-stone progress', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/Question 1 of \d+/)).toBeTruthy();
    expect(screen.getByTestId('stepping-stones')).toBeTruthy();
    // Only the first question's card is rendered — not the full bank.
    expect(
      screen.getByText('What language(s) does your family mainly speak at home?'),
    ).toBeTruthy();
    // Hints are interpolated too — no raw "[child]" ever reaches the caregiver.
    expect(screen.queryByText(/\[child\]/)).toBeNull();
    expect(
      screen.queryByText(/Does Alex hear more than one language regularly/),
    ).toBeNull();
  });

  it('interpolates [child] with the fetched nickname in question text', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/ABOUT ALEX/)).toBeTruthy();
    // T4 is a real shipped toddler question referencing [child].
    skipToQuestion(
      "When you call Alex's name from across the room, what usually happens?",
    );
  });

  it('auto-advances on a single-select answer and keeps it when going back', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // U3 (question 2) is the first single-select.
    fireEvent.press(screen.getByTestId('skip-button'));
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy();
    fireEvent.press(screen.getByText('Not sure'));

    // One tap = one step forward.
    expect(screen.getByText(/Question 3 of \d+/)).toBeTruthy();

    // Back shows the same question with the selection preserved.
    fireEvent.press(screen.getByTestId('back-button'));
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not sure', selected: true })).toBeTruthy();
  });

  it('multi-select questions collect until Next instead of auto-advancing', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // U2 (question 1) is chip_multi_select: Next starts disabled.
    fireEvent.press(screen.getByTestId('next-button'));
    expect(screen.getByText(/Question 1 of \d+/)).toBeTruthy();

    fireEvent.press(screen.getByText('English'));
    expect(screen.getByText(/Question 1 of \d+/)).toBeTruthy(); // still here

    fireEvent.press(screen.getByTestId('next-button'));
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy();
  });

  it('shows the halfway encouragement at the midpoint of the path', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    expect(screen.queryByTestId('halfway-encouragement')).toBeNull();
    skipToQuestion(
      "When you call Alex's name from across the room, what usually happens?",
    );
    // T4 sits at index 12 of 25 — the midpoint for a toddler bank.
    expect(screen.getByTestId('halfway-encouragement')).toBeTruthy();
  });

  it('only submits answered questions, with the correct payload shape', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToQuestion(
      "When you call Alex's name from across the room, what usually happens?",
    );
    fireEvent.press(screen.getByText('Looks or comes right away'));
    skipToReview();
    // The review step reflects how much was shared.
    expect(screen.getByText(/You answered 1 of \d+/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(submitIntakeResponses).toHaveBeenCalled());
    const [childId, responses] = (submitIntakeResponses as jest.Mock).mock.calls[0];
    expect(childId).toBe('c1');
    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({ question_id: 'T4', answer: 'looks_right_away' });
  });

  it('navigates to Results after a successful submit', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('shows a retryable error and does not navigate when submission fails', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockRejectedValue(new Error('network down'));
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByText(/couldn't save your answers/i)).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('does not render unanswerable questions (no options, not free-text)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // U1 ("How old is [child]?") ships with an empty options array — nothing to tap.
    // Walk the whole path and make sure it never appears.
    for (let i = 0; i < 60 && screen.queryByTestId('skip-button'); i++) {
      expect(screen.queryByText('How old is Alex?')).toBeNull();
      fireEvent.press(screen.getByTestId('skip-button'));
    }
    expect(screen.getByTestId('submit-button')).toBeTruthy();
  });

  it('actually refetches when Try again is pressed after a load failure', async () => {
    (getChild as jest.Mock)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/couldn't load the questions/i);

    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByText(/Question 1 of \d+/)).toBeTruthy();
    expect(getChild).toHaveBeenCalledTimes(2);
  });

  it('offers the consent center (not a futile retry) when saving is refused for consent', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockRejectedValue(
      new ApiError(403, { message: 'Saving answers requires data-storage consent' }),
    );
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByText(/permission to save them/i)).toBeTruthy();
    expect(screen.queryByText(/couldn't save your answers/i)).toBeNull();

    fireEvent.press(screen.getByTestId('update-permissions-button'));
    expect(navigation.navigate).toHaveBeenCalledWith('ConsentCenter');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
