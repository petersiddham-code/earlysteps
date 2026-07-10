import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FollowUpCheckScreen } from './FollowUpCheckScreen';
import { analyzeResponses, answerFollowUpSuggestion, getChild } from '../../api/index.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({
  analyzeResponses: jest.fn(),
  answerFollowUpSuggestion: jest.fn(),
  getChild: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({
  ...jest.requireActual('../../session/index.js'),
  useSession: jest.fn(),
}));

function navProp() {
  return { replace: jest.fn(), navigate: jest.fn() } as unknown as Parameters<
    typeof FollowUpCheckScreen
  >[0]['navigation'];
}

const FOLLOW_UP_SUGGESTION = {
  id: 'suggestion-1',
  follow_up_id: 'FU_loss_of_skills',
  red_flag_type: 'loss_of_skills' as const,
  text: 'Thinking about what you wrote — has [child] lost words or skills they used to have?',
  hint: 'Only choose yes if that matches what you meant. Your answer here is what counts, not our reading of it.',
  source_question_id: 'T2',
  source_quote: 'stopped speaking',
};

const ANOTHER_FOLLOW_UP = {
  id: 'suggestion-2',
  follow_up_id: 'FU_self_injury_risk',
  red_flag_type: 'self_injury_risk' as const,
  text: 'You mentioned something about [child] hurting themselves — has that been happening?',
  hint: 'Your answer here is what counts, not our reading of it.',
  source_question_id: 'T5',
  source_quote: 'hits his head when upset',
};

describe('FollowUpCheckScreen (issue #102)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      isGuest: false,
      tier: 'premium',
    });
    (getChild as jest.Mock).mockResolvedValue({
      id: 'c1',
      family_id: 'f1',
      nickname: 'Ava',
      age_band: 'toddler',
      languages: ['English'],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows a loading state while the analysis call is in flight', async () => {
    (analyzeResponses as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
    render(<FollowUpCheckScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByTestId('follow-up-check-loading')).toBeTruthy();
    expect(screen.getByText(/Looking at what you shared/)).toBeTruthy();
  });

  it('renders every pending follow-up together, all at once', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([
      FOLLOW_UP_SUGGESTION,
      ANOTHER_FOLLOW_UP,
    ]);
    render(<FollowUpCheckScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByTestId('follow-up-FU_loss_of_skills')).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_self_injury_risk')).toBeTruthy();
  });

  it('no pending follow-ups -> goes straight to Results', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('a failed analysis call -> goes straight to Results, never stuck', async () => {
    (analyzeResponses as jest.Mock).mockRejectedValue(new Error('offline'));
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('times out after 8 seconds and goes straight to Results if analysis never returns', async () => {
    (analyzeResponses as jest.Mock).mockReturnValue(new Promise(() => {}));
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('follow-up-check-loading');
    expect(navigation.replace).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(8000);
    });

    expect(navigation.replace).toHaveBeenCalledWith('Results');
  });

  it('confirming yes submits the answer and moves to Results once every follow-up is answered', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([FOLLOW_UP_SUGGESTION]);
    (answerFollowUpSuggestion as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('follow-up-FU_loss_of_skills');

    fireEvent.press(screen.getByTestId('follow-up-FU_loss_of_skills-yes'));

    await waitFor(() =>
      expect(answerFollowUpSuggestion).toHaveBeenCalledWith('c1', 'suggestion-1', 'yes'),
    );
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('only navigates once ALL shown follow-ups are answered, not after the first', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([
      FOLLOW_UP_SUGGESTION,
      ANOTHER_FOLLOW_UP,
    ]);
    (answerFollowUpSuggestion as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('follow-up-FU_loss_of_skills');

    fireEvent.press(screen.getByTestId('follow-up-FU_loss_of_skills-yes'));
    await waitFor(() =>
      expect(answerFollowUpSuggestion).toHaveBeenCalledWith('c1', 'suggestion-1', 'yes'),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('follow-up-FU_self_injury_risk')).toBeTruthy();

    fireEvent.press(screen.getByTestId('follow-up-FU_self_injury_risk-not_sure'));
    await waitFor(() =>
      expect(answerFollowUpSuggestion).toHaveBeenCalledWith(
        'c1',
        'suggestion-2',
        'not_sure',
      ),
    );
    expect(navigation.replace).toHaveBeenCalledWith('Results');
  });

  it('a failed answer keeps the question on screen with a retryable message', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([FOLLOW_UP_SUGGESTION]);
    (answerFollowUpSuggestion as jest.Mock).mockRejectedValue(new Error('offline'));
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('follow-up-FU_loss_of_skills');

    fireEvent.press(screen.getByTestId('follow-up-FU_loss_of_skills-yes'));

    expect(await screen.findByText(/couldn't save that answer/i)).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills')).toBeTruthy();
  });

  it('"See my results now" always offers a manual way out — never a trap', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([FOLLOW_UP_SUGGESTION]);
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('follow-up-FU_loss_of_skills');

    fireEvent.press(screen.getByTestId('skip-follow-up-check'));

    expect(navigation.replace).toHaveBeenCalledWith('Results');
  });

  it('no childId -> goes straight to Results', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: null,
      isGuest: false,
      tier: 'premium',
    });
    const navigation = navProp();
    render(<FollowUpCheckScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
    expect(analyzeResponses).not.toHaveBeenCalled();
  });
});
