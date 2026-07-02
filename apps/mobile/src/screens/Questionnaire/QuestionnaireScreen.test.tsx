import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QuestionnaireScreen } from './QuestionnaireScreen';
import { getChild, submitIntakeResponses } from '../../api/index.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({
  getChild: jest.fn(),
  submitIntakeResponses: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
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

describe('QuestionnaireScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ familyId: 'f1', childId: 'c1' });
  });

  it('interpolates [child] with the fetched nickname in question text', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/A few questions about Alex/)).toBeTruthy();
    // T4 is a real shipped toddler question referencing [child].
    expect(
      await screen.findByText(
        "When you call Alex's name from across the room, what usually happens?",
      ),
    ).toBeTruthy();
  });

  it('only submits answered questions, with the correct payload shape', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);

    await screen.findByText(/A few questions about Alex/);
    fireEvent.press(screen.getByText('Looks or comes right away'));
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

    await screen.findByText(/A few questions about Alex/);
    fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('shows a retryable error and does not navigate when submission fails', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockRejectedValue(new Error('network down'));
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);

    await screen.findByText(/A few questions about Alex/);
    fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByText(/couldn't save your answers/i)).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
