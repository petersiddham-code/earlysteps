import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { EVIDENCE_FLOORS, getQuestionBank } from '@earlysteps/content';
import { AUTO_ADVANCE_DELAY_MS, QuestionnaireScreen } from './QuestionnaireScreen';
import { getChild, getIntakeResponses, submitIntakeResponses } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';

jest.mock('../../api/index.js', () => ({
  getChild: jest.fn(),
  getIntakeResponses: jest.fn(),
  submitIntakeResponses: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({
  // canUseAiFeatures is real — only useSession is a mock (issue #99).
  ...jest.requireActual('../../session/index.js'),
  useSession: jest.fn(),
}));

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

/** The top-right forward control: "Skip" when unanswered, "Next" once answered. */
function forwardButton() {
  return screen.queryByTestId('skip-button') ?? screen.queryByTestId('next-button');
}

/** Skip forward through the wizard until `matcher` is on screen (or fail loudly). */
function skipToQuestion(matcher: string | RegExp) {
  for (let i = 0; i < 60; i++) {
    if (screen.queryByText(matcher)) return;
    const forward = forwardButton();
    if (!forward) throw new Error(`Reached the review step without finding ${matcher}`);
    fireEvent.press(forward);
  }
  throw new Error(`Question not found after 60 skips: ${matcher}`);
}

/** Skip forward until the review step's submit button is on screen. */
function skipToReview() {
  for (let i = 0; i < 60; i++) {
    if (screen.queryByTestId('submit-button')) return;
    fireEvent.press(forwardButton()!);
  }
  throw new Error('Never reached the review step');
}

describe('QuestionnaireScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: a logged-in premium account, so existing free-text tests exercise full
    // functionality unless a test opts into guest/free-tier gating (issue #99).
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      isGuest: false,
      tier: 'premium',
    });
    // Default: a first visit — nothing answered yet, the full bank is asked.
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
  });

  it('shows one question at a time with stepping-stone progress', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/Question 1 of \d+/)).toBeTruthy();
    expect(screen.getByTestId('stepping-stones')).toBeTruthy();
    // Family languages (U2) was already answered during Child Profile Setup — the flow
    // must not re-ask it (#24), so the path opens with U3 instead.
    expect(
      screen.queryByText('What language(s) does your family mainly speak at home?'),
    ).toBeNull();
    expect(
      screen.getByText(/Does Alex hear more than one language regularly/),
    ).toBeTruthy();
    // Hints are interpolated too — no raw "[child]" ever reaches the caregiver.
    expect(screen.queryByText(/\[child\]/)).toBeNull();
    // Only the first question's card is rendered — not the full bank.
    expect(screen.queryByText(/born on their due date/)).toBeNull();
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

  it('auto-advances on a single-select answer — after a visible pause — and keeps it when going back', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);
    jest.useFakeTimers();

    // U3 (question 1 now that U2 is collected at profile setup) is the first single-select.
    fireEvent.press(screen.getByText('Not sure'));

    // Not an instant jump: the selection stays visible for a beat first.
    expect(screen.getByText(/Question 1 of \d+/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not sure', selected: true })).toBeTruthy();
    act(() => jest.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS));
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy();

    // Back shows the same question with the selection preserved.
    fireEvent.press(screen.getByTestId('back-button'));
    expect(screen.getByText(/Question 1 of \d+/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not sure', selected: true })).toBeTruthy();

    // And Next is available (enabled) so the caregiver can move forward again
    // without re-tapping their answer or hitting a misleading "Skip".
    fireEvent.press(screen.getByTestId('next-button'));
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy();
    jest.useRealTimers();
  });

  it('a manual move during the auto-advance pause moves one step, not two', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);
    jest.useFakeTimers();

    fireEvent.press(screen.getByText('Not sure')); // U3 (Q1): pause starts, forward flips to Next
    fireEvent.press(screen.getByTestId('next-button')); // manual move cancels the timer
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy();

    act(() => jest.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS * 2));
    expect(screen.getByText(/Question 2 of \d+/)).toBeTruthy(); // still one step
    jest.useRealTimers();
  });

  it('the fixed top-right control reads Skip until answered, then becomes Next', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // U7 (multi-select, so no auto-advance muddies the check) unanswered: Skip, no Next.
    skipToQuestion('What made you want to check in today?');
    expect(screen.getByTestId('skip-button')).toBeTruthy();
    expect(screen.queryByTestId('next-button')).toBeNull();

    // Answering flips the same slot to Next.
    fireEvent.press(screen.getByText('Something I noticed myself'));
    expect(screen.getByTestId('next-button')).toBeTruthy();
    expect(screen.queryByTestId('skip-button')).toBeNull();
  });

  it('multi-select questions collect until Next instead of auto-advancing', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // U7 is chip_multi_select: picking chips does not advance.
    skipToQuestion('What made you want to check in today?');
    fireEvent.press(screen.getByText('Something I noticed myself'));
    expect(screen.getByText('What made you want to check in today?')).toBeTruthy(); // still here
    fireEvent.press(screen.getByText('A family member raised it'));
    expect(screen.getByText('What made you want to check in today?')).toBeTruthy(); // still here

    fireEvent.press(screen.getByTestId('next-button'));
    expect(screen.queryByText('What made you want to check in today?')).toBeNull();
  });

  it('shows the halfway encouragement at the midpoint of the path', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    expect(screen.queryByTestId('halfway-encouragement')).toBeNull();
    skipToQuestion('Does Alex play pretend yet, like feeding a teddy bear or "talking" on a toy phone?');
    // T9 sits at index 20 of 41 — the midpoint for a toddler path (12 universal + 29
    // toddler, with U1/U2 collected at profile setup). Issue #113 added T27/T28/T29
    // (motor coverage, appended at the end of the bank), shifting the midpoint from T8
    // (index 19 of 38, set by issue #82's T25/T26) to T9.
    expect(screen.getByTestId('halfway-encouragement')).toBeTruthy();
  });

  it('offers "add anything else" on flagged questions, holds auto-advance, and submits the note namespaced', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // T4 is not flagged — no free-text box there.
    skipToQuestion(
      "When you call Alex's name from across the room, what usually happens?",
    );
    expect(screen.queryByTestId('free-text-T4')).toBeNull();

    // T12 (sensory sounds) is flagged allow_free_text.
    skipToQuestion(/get upset or cover their ears at loud sounds/);

    // Picking an option must NOT auto-advance — the caregiver may still want to type.
    fireEvent.press(screen.getByText('Yes, a lot'));
    expect(screen.getByText(/get upset or cover their ears at loud sounds/)).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId('free-text-T12'),
      'does not like other kids crying or whining',
    );
    fireEvent.press(screen.getByTestId('next-button'));
    expect(screen.queryByText(/get upset or cover their ears at loud sounds/)).toBeNull();

    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => expect(submitIntakeResponses).toHaveBeenCalled());
    const [, responses] = (submitIntakeResponses as jest.Mock).mock.calls[0];
    expect(responses).toContainEqual(
      expect.objectContaining({
        question_id: 'T12',
        answer: ['yes_a_lot', 'free_text:does not like other kids crying or whining'],
      }),
    );
  });

  it('"Other — type it": typed text is submitted as a free_text entry with the other id (#28)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // U9 (strengths) is a real shipped multi-select with an "Other — type it" option.
    skipToQuestion('What does Alex love doing most?');
    expect(screen.queryByTestId('other-input-U9')).toBeNull();
    fireEvent.press(screen.getByText('Other — type it'));
    fireEvent.changeText(screen.getByTestId('other-input-U9'), 'trains');
    fireEvent.press(screen.getByTestId('next-button'));

    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => expect(submitIntakeResponses).toHaveBeenCalled());
    const [, responses] = (submitIntakeResponses as jest.Mock).mock.calls[0];
    expect(responses).toContainEqual(
      expect.objectContaining({
        question_id: 'U9',
        answer: ['other', 'free_text:trains'],
      }),
    );
  });

  it('unchecking "Other" discards its typed text — it never rides into the submission (#28)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToQuestion('What does Alex love doing most?');
    fireEvent.press(screen.getByText('Other — type it'));
    fireEvent.changeText(screen.getByTestId('other-input-U9'), 'trains');
    fireEvent.press(screen.getByText('Other — type it')); // uncheck
    expect(screen.queryByTestId('other-input-U9')).toBeNull();
    fireEvent.press(screen.getByText('Music')); // keep the question answered
    fireEvent.press(screen.getByTestId('next-button'));

    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => expect(submitIntakeResponses).toHaveBeenCalled());
    const [, responses] = (submitIntakeResponses as jest.Mock).mock.calls[0];
    expect(responses).toContainEqual(
      expect.objectContaining({ question_id: 'U9', answer: ['music'] }),
    );
  });

  it('a typed note alone (no option picked) counts as an answer and is submitted', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToQuestion(/avoid certain textures/); // T13, flagged allow_free_text
    fireEvent.changeText(screen.getByTestId('free-text-T13'), 'only certain socks');
    fireEvent.press(screen.getByTestId('next-button')); // enabled by the note alone

    skipToReview();
    expect(screen.getByText(/You answered 1 of \d+/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('submit-button'));
    await waitFor(() => expect(submitIntakeResponses).toHaveBeenCalled());
    const [, responses] = (submitIntakeResponses as jest.Mock).mock.calls[0];
    expect(responses).toEqual([
      expect.objectContaining({
        question_id: 'T13',
        answer: ['free_text:only certain socks'],
      }),
    ]);
  });

  it('disables the "add anything else" free-text box for a guest session (issue #99)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'guest:c1',
      isGuest: true,
      tier: null,
    });
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToQuestion(/avoid certain textures/); // T13, flagged allow_free_text
    expect(screen.getByTestId('free-text-T13').props.editable).toBe(false);
  });

  it('disables the "add anything else" free-text box for a logged-in free-tier account (issue #99)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      isGuest: false,
      tier: 'free',
    });
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToQuestion(/avoid certain textures/); // T13, flagged allow_free_text
    expect(screen.getByTestId('free-text-T13').props.editable).toBe(false);
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

  it('sets expectations at the review step when very few questions were answered (issue #22)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToReview();

    expect(screen.getByText(/You answered 0 of \d+/)).toBeTruthy();
    // Honest, guilt-free: the next screen will mostly say "not enough information yet".
    expect(screen.getByTestId('low-evidence-notice')).toHaveTextContent(
      /may not have much to share yet/,
    );
    // The stones must agree with the counter: nothing answered, nothing filled (#37).
    expect(screen.queryByTestId('stone-done')).toBeNull();
    expect(screen.getAllByTestId('stone-skipped').length).toBeGreaterThan(0);
  });

  it('drops the low-evidence notice once enough questions are answered (issue #22)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // Walk the wizard answering "Not sure" wherever it exists (always an option, never a
    // trap) until the evidence floor is met, skipping everything else.
    let answered = 0;
    for (let i = 0; i < 60 && !screen.queryByTestId('submit-button'); i++) {
      const notSure = screen.queryByTestId('option-radio-not_sure');
      if (notSure && answered < EVIDENCE_FLOORS.min_scored_answers_overall) {
        fireEvent.press(notSure);
        answered += 1;
        fireEvent.press(screen.getByTestId('next-button'));
      } else {
        fireEvent.press(forwardButton()!);
      }
    }

    expect(answered).toBeGreaterThanOrEqual(EVIDENCE_FLOORS.min_scored_answers_overall);
    expect(screen.getByText(new RegExp(`You answered ${answered} of \\d+`))).toBeTruthy();
    expect(screen.queryByTestId('low-evidence-notice')).toBeNull();
  });

  it('navigates to Results after a successful submit', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    fireEvent.press(screen.getByText('Yes')); // answer Q1 (U3) so there is something to save
    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
  });

  it('navigates to FollowUpCheck, not Results, when a Premium submission includes free text (issue #102)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToQuestion(/avoid certain textures/); // T13, flagged allow_free_text
    fireEvent.changeText(screen.getByTestId('free-text-T13'), 'only certain socks');
    fireEvent.press(screen.getByTestId('next-button'));
    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('FollowUpCheck'));
    expect(navigation.replace).not.toHaveBeenCalledWith('Results');
  });

  it('still navigates straight to Results for a free-tier account, never FollowUpCheck (issue #102)', async () => {
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      isGuest: false,
      tier: 'free',
    });
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockResolvedValue({});
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    fireEvent.press(screen.getByText('Yes')); // answer Q1 (U3) so there is something to save
    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Results'));
    expect(navigation.replace).not.toHaveBeenCalledWith('FollowUpCheck');
  });

  it('skips the save entirely when every question was skipped — straight to Results (#20)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    skipToReview();
    expect(screen.getByText(/You answered 0 of \d+/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('submit-button'));

    // An empty batch is a backend validation error — never send one. Skipping all
    // questions must not dead-end in "we couldn't save your answers". The emptySubmit
    // param tells Results a 404 means "answered nothing yet" so it renders the honest
    // empty state instead of bouncing back here like a silent reset (#53).
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('Results', { emptySubmit: true }),
    );
    expect(submitIntakeResponses).not.toHaveBeenCalled();
    expect(screen.queryByText(/couldn't save your answers/i)).toBeNull();
  });

  it('shows a retryable error and does not navigate when submission fails', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (submitIntakeResponses as jest.Mock).mockRejectedValue(new Error('network down'));
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    fireEvent.press(screen.getByText('Yes')); // answer Q1 (U3) so the save is attempted
    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByText(/couldn't save your answers/i)).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('never asks questions already collected at profile setup (U1 age, U2 languages) (#24)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // Both are answered during Child Profile Setup and flagged
    // `collected_at: "profile_setup"` in the universal bank — walk the whole path and
    // make sure neither is ever asked again.
    for (let i = 0; i < 60 && screen.queryByTestId('skip-button'); i++) {
      expect(screen.queryByText('How old is Alex?')).toBeNull();
      expect(
        screen.queryByText('What language(s) does your family mainly speak at home?'),
      ).toBeNull();
      fireEvent.press(screen.getByTestId('skip-button'));
    }
    expect(screen.getByTestId('submit-button')).toBeTruthy();
  });

  it('never re-asks a question that already has an answer (#42)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (getIntakeResponses as jest.Mock).mockResolvedValue([
      { question_id: 'T4', domain: 'social', answer: 'looks_right_away', timestamp: 't' },
    ]);
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/Question 1 of \d+/);

    // Walk the whole path: T4 (already answered) must never come up again.
    for (let i = 0; i < 60 && !screen.queryByTestId('submit-button'); i++) {
      expect(
        screen.queryByText(
          "When you call Alex's name from across the room, what usually happens?",
        ),
      ).toBeNull();
      fireEvent.press(forwardButton()!);
    }
    expect(screen.getByTestId('submit-button')).toBeTruthy();
  });

  it('a failed answer-history fetch falls back to the full bank, never a blank screen (#42)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    (getIntakeResponses as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<QuestionnaireScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/Question 1 of \d+/)).toBeTruthy();
    expect(screen.queryByText(/couldn't load the questions/i)).toBeNull();
  });

  it('shows a calm all-answered state (not "Question 1 of 0") when nothing is left to ask (#42)', async () => {
    (getChild as jest.Mock).mockResolvedValue(CHILD);
    // Every question in both banks already has an answer — including the
    // profile-setup-collected ones, which the filter drops anyway.
    const everyQuestionAnswered = [
      ...(getQuestionBank('universal')?.questions ?? []),
      ...(getQuestionBank('toddler')?.questions ?? []),
    ].map((q) => ({
      question_id: q.id,
      domain: q.domain,
      answer: 'not_sure',
      timestamp: 't',
    }));
    (getIntakeResponses as jest.Mock).mockResolvedValue(everyQuestionAnswered);
    const navigation = navProp();
    render(<QuestionnaireScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('all-answered-state')).toBeTruthy();
    expect(
      screen.getByText(/already answered every question we have about Alex/),
    ).toBeTruthy();
    expect(screen.queryByText(/Question \d+ of/)).toBeNull();
    expect(screen.queryByTestId('submit-button')).toBeNull();

    fireEvent.press(screen.getByTestId('all-answered-results-button'));
    expect(navigation.replace).toHaveBeenCalledWith('Results');
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

    fireEvent.press(screen.getByText('Yes')); // answer Q1 (U3) so the save is attempted
    skipToReview();
    fireEvent.press(screen.getByTestId('submit-button'));

    expect(await screen.findByText(/permission to save them/i)).toBeTruthy();
    expect(screen.queryByText(/couldn't save your answers/i)).toBeNull();

    fireEvent.press(screen.getByTestId('update-permissions-button'));
    expect(navigation.navigate).toHaveBeenCalledWith('ConsentCenter');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
