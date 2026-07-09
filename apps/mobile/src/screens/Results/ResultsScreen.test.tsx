import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ResultsScreen } from './ResultsScreen';
import {
  analyzeResponses,
  answerFollowUpSuggestion,
  getChild,
  getIntakeResponses,
  getResults,
} from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import { SCREENING_DISCLAIMER } from '@earlysteps/shared-types';

jest.mock('../../api/index.js', () => ({
  getResults: jest.fn(),
  getIntakeResponses: jest.fn(),
  analyzeResponses: jest.fn(),
  answerFollowUpSuggestion: jest.fn(),
  getChild: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn(), navigate: jest.fn() } as unknown as Parameters<
    typeof ResultsScreen
  >[0]['navigation'];
}

const RESULTS = {
  disclaimer: SCREENING_DISCLAIMER,
  computedAt: '2026-07-01T00:00:00.000Z',
  basedOnAnswers: 12,
  domains: [
    {
      domain: 'social' as const,
      status: 'scored' as const,
      label: 'Many signs observed' as const,
      confidence: 'low' as const,
    },
    {
      domain: 'communication' as const,
      status: 'scored' as const,
      label: 'Low signs observed' as const,
      confidence: 'high' as const,
    },
  ],
  supportLevel: { term: 'high support needs' as const, confidence: 'low' as const },
  insufficientEvidenceOverall: false,
  redFlagTypes: ['no_name_response' as const],
  recommendationTier: 'Formal assessment is recommended' as const,
};

/** The minimum-evidence gate output (issue #22): one answer, nothing to show but honesty. */
const INSUFFICIENT_RESULTS = {
  disclaimer: SCREENING_DISCLAIMER,
  computedAt: '2026-07-01T00:00:00.000Z',
  basedOnAnswers: 1,
  domains: [
    {
      domain: 'social' as const,
      status: 'insufficient_evidence' as const,
      label: 'Not enough information yet' as const,
    },
  ],
  supportLevel: null,
  insufficientEvidenceOverall: true,
  redFlagTypes: [] as never[],
  recommendationTier: null,
};

/** Zero questions answered (all skipped, issue #32): nothing scored, nothing gated. */
const EMPTY_RESULTS = {
  disclaimer: SCREENING_DISCLAIMER,
  computedAt: '2026-07-01T00:00:00.000Z',
  basedOnAnswers: 0,
  domains: [] as never[],
  supportLevel: null,
  insufficientEvidenceOverall: true,
  redFlagTypes: [] as never[],
  recommendationTier: null,
};

const FOLLOW_UP_SUGGESTION = {
  id: 'suggestion-1',
  follow_up_id: 'FU_loss_of_skills',
  red_flag_type: 'loss_of_skills' as const,
  text: 'Thinking about what you wrote — has [child] lost words or skills they used to have?',
  hint: 'Only choose yes if that matches what you meant. Your answer here is what counts, not our reading of it.',
  source_question_id: 'T2',
  source_quote: 'he stopped speaking last month',
};

const clearChildId = jest.fn().mockResolvedValue(undefined);

describe('ResultsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearChildId.mockResolvedValue(undefined);
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      clearChildId,
    });
    // Default: analysis is a no-op extra — most tests exercise plain results.
    (analyzeResponses as jest.Mock).mockResolvedValue([]);
    (getChild as jest.Mock).mockResolvedValue({
      id: 'c1',
      family_id: 'f1',
      nickname: 'Ava',
      age_band: 'toddler',
      languages: ['English'],
    });
  });

  it('renders the disclaimer, strengths-first, domains, and recommendation', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([
      { question_id: 'U9', domain: 'strengths', answer: ['music'], timestamp: 't' },
    ]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(SCREENING_DISCLAIMER)).toBeTruthy();
    expect(screen.getByText('Music')).toBeTruthy(); // reflected back from their own answer
    expect(screen.getByText(/Many signs observed/)).toBeTruthy();
    expect(screen.getByText('Formal assessment is recommended')).toBeTruthy();
    // Whose results these are (#41): the child's name heads the screen.
    expect(await screen.findByText('ABOUT AVA')).toBeTruthy();
  });

  it('falls back to "ABOUT YOUR CHILD" when the nickname fetch fails (#41)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    (getChild as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(screen.getByText('ABOUT YOUR CHILD')).toBeTruthy();
  });

  it('shows a caregiver-typed strength verbatim (their own words, free_text: stripped)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([
      {
        question_id: 'U9',
        domain: 'strengths',
        answer: ['music', 'free_text:builds huge lego towers'],
        timestamp: 't',
      },
    ]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(screen.getByText('Music')).toBeTruthy();
    expect(screen.getByText('builds huge lego towers')).toBeTruthy();
    expect(screen.queryByText(/free_text:/)).toBeNull();
  });

  it('renders strengths before support-need domains in the tree (CLAUDE.md §2 rule 6)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([
      { question_id: 'U9', domain: 'strengths', answer: ['music'], timestamp: 't' },
    ]);
    const { toJSON } = render(
      <ResultsScreen navigation={navProp()} route={{} as never} />,
    );
    await screen.findByText(SCREENING_DISCLAIMER);

    const allText = JSON.stringify(toJSON());
    expect(allText.indexOf('Strengths')).toBeLessThan(
      allText.indexOf('social interaction style'),
    );
  });

  it('derives needs from non-low domains using the approved domain vocabulary', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    // Appears twice: once in the derived "needs" list, once in the domain's TrafficLightBar.
    expect(await screen.findAllByText('social interaction style')).toHaveLength(2);
    // "Low signs observed" domain (communication) should NOT show up as a need — only once,
    // in its own TrafficLightBar.
    expect(screen.getAllByText('communication differences')).toHaveLength(1);
  });

  it('shows the provenance line — what the results rest on and when (issue #22)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(screen.getByTestId('provenance-line')).toHaveTextContent(
      /Based on 12 answers · last updated /,
    );
  });

  it('renders "not enough information yet" for a gated view: no level, no support needs, no recommendation (issue #22)', async () => {
    (getResults as jest.Mock).mockResolvedValue(INSUFFICIENT_RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    // Twice: once on the gated domain's row, once heading the next-step card (#32).
    expect(screen.getAllByText('Not enough information yet')).toHaveLength(2);
    expect(screen.getByTestId('insufficient-domain-detail')).toBeTruthy();
    expect(screen.getByTestId('insufficient-overall-detail')).toBeTruthy();
    // Nothing stronger than the evidence: no sign level, no support term, no tier.
    expect(screen.queryByText(/signs observed/i)).toBeNull();
    expect(screen.queryByText(/(mild|moderate|high) support needs/i)).toBeNull();
    expect(screen.queryByText(/Formal assessment|Support activities/i)).toBeNull();
    // A gated domain is a gap, not a need — it renders once (its own row), never again
    // in the derived support-needs list.
    expect(screen.getAllByText('social interaction style')).toHaveLength(1);
    // Singular provenance for a single answer.
    expect(screen.getByTestId('provenance-line')).toHaveTextContent(/Based on 1 answer /);
    // The state explains itself (#42): what the gate means, never a claim about the child.
    expect(screen.getByTestId('insufficient-overall-explanation')).toHaveTextContent(
      /isn't a finding about your child/,
    );
  });

  it('a gated view offers "Answer more questions" — same child, no reset (#42)', async () => {
    (getResults as jest.Mock).mockResolvedValue(INSUFFICIENT_RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(<ResultsScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(SCREENING_DISCLAIMER);

    fireEvent.press(screen.getByTestId('answer-more-button'));

    // Back into the questionnaire for the SAME child — the child is never forgotten,
    // unlike "Start a new set of questions".
    expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
    expect(clearChildId).not.toHaveBeenCalled();
  });

  it('a fully scored view does not offer "Answer more questions" (#42)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(screen.queryByTestId('answer-more-button')).toBeNull();
  });

  it('renders a clean empty state when 0 questions were answered: no bare headings, no empty cards (issue #32)', async () => {
    (getResults as jest.Mock).mockResolvedValue(EMPTY_RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    // No content-less "Strengths"/"Support needs" headings and no empty domain card.
    expect(screen.queryByText('Strengths')).toBeNull();
    expect(screen.queryByText('Support needs')).toBeNull();
    expect(screen.queryByTestId('insufficient-domain-detail')).toBeNull();
    // The one honest statement: not enough information yet, answers are saved.
    expect(screen.getByTestId('insufficient-overall-label')).toHaveTextContent(
      'Not enough information yet',
    );
    expect(screen.getByTestId('insufficient-overall-detail')).toBeTruthy();
    // Never a tier off zero evidence — "Support activities can begin now" was the bug.
    expect(screen.queryByText(/Formal assessment|Support activities/i)).toBeNull();
    expect(screen.getByTestId('provenance-line')).toHaveTextContent(/Based on 0 answers/);
  });

  it('still surfaces a red flag and its recommendation when 0 domains scored (issues #32 + #22)', async () => {
    (getResults as jest.Mock).mockResolvedValue({
      ...EMPTY_RESULTS,
      basedOnAnswers: 1,
      redFlagTypes: ['loss_of_skills' as const],
      recommendationTier: 'Formal assessment is recommended' as const,
    });
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(
      screen.getByText(/may benefit from being seen soon by a doctor/i),
    ).toBeTruthy();
    expect(screen.getByText('Formal assessment is recommended')).toBeTruthy();
    // Still no bare strengths/needs headings around the banner.
    expect(screen.queryByText('Strengths')).toBeNull();
    expect(screen.queryByText('Support needs')).toBeNull();
  });

  it('red flags are EXEMPT from the gate: banner and recommendation still surface on a gated view (issue #22)', async () => {
    (getResults as jest.Mock).mockResolvedValue({
      ...INSUFFICIENT_RESULTS,
      redFlagTypes: ['self_injury_risk' as const],
      recommendationTier: 'Formal assessment strongly recommended soon' as const,
    });
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(
      screen.getByText(/may benefit from being seen soon by a doctor/i),
    ).toBeTruthy();
    expect(screen.getByText('Formal assessment strongly recommended soon')).toBeTruthy();
    // The tier replaces the "not enough info" next-step copy — never both, they contradict.
    expect(screen.queryByTestId('insufficient-overall-detail')).toBeNull();
    // Domains are still gated, so the path to more answers stays offered (#42).
    expect(screen.getByTestId('answer-more-button')).toBeTruthy();
  });

  it('shows the red flag banner for the returned red flag types', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    expect(
      await screen.findByText(/may benefit from being seen soon by a doctor/i),
    ).toBeTruthy();
  });

  it('shows an error state when loading fails', async () => {
    (getResults as jest.Mock).mockRejectedValue(new Error('network down'));
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(/couldn't load your results/i)).toBeTruthy();
  });

  it('routes to the Questionnaire when the child has no computed results yet (404)', async () => {
    (getResults as jest.Mock).mockRejectedValue(
      new ApiError(404, { message: 'No computed results yet for child c1' }),
    );
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(<ResultsScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Questionnaire'));
    // Never stranded on an unresolvable error.
    expect(screen.queryByText(/couldn't load your results/i)).toBeNull();
  });

  it('shows the not-enough-information state after an all-skipped submit instead of bouncing to Question 1 (#53)', async () => {
    (getResults as jest.Mock).mockRejectedValue(
      new ApiError(404, { message: 'No computed results yet for child c1' }),
    );
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(
      <ResultsScreen
        navigation={navigation}
        route={{ params: { emptySubmit: true } } as never}
      />,
    );

    expect(await screen.findByTestId('empty-results-state')).toBeTruthy();
    // The honest gate state, with the disclaimer (§2 rule 5) — not a silent reset.
    expect(screen.getByText(SCREENING_DISCLAIMER)).toBeTruthy();
    expect(screen.getByTestId('insufficient-overall-label')).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/couldn't load your results/i)).toBeNull();
  });

  it('offers every path forward from the empty state: answer more, new questions, permissions (#53)', async () => {
    (getResults as jest.Mock).mockRejectedValue(
      new ApiError(404, { message: 'No computed results yet for child c1' }),
    );
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(
      <ResultsScreen
        navigation={navigation}
        route={{ params: { emptySubmit: true } } as never}
      />,
    );
    await screen.findByTestId('empty-results-state');

    fireEvent.press(screen.getByTestId('answer-more-button'));
    expect(navigation.replace).toHaveBeenCalledWith('Questionnaire');
    expect(screen.getByTestId('new-questions-button')).toBeTruthy();
    expect(screen.getByTestId('permissions-button')).toBeTruthy();
  });

  it('starts a new set of questions: forgets the child, then child details (#20)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(<ResultsScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(SCREENING_DISCLAIMER);

    fireEvent.press(screen.getByTestId('new-questions-button'));

    // The child must be forgotten BEFORE navigating — the app holds one child at a
    // time, and a fresh screening starts from the child's details, not the questions.
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('ChildProfileSetup'),
    );
    expect(clearChildId).toHaveBeenCalled();
    expect(clearChildId.mock.invocationCallOrder[0]).toBeLessThan(
      (navigation.replace as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it('offers a way back to the Consent Center to review permissions (#20)', async () => {
    (getResults as jest.Mock).mockResolvedValue(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    const navigation = navProp();
    render(<ResultsScreen navigation={navigation} route={{} as never} />);
    await screen.findByText(SCREENING_DISCLAIMER);

    fireEvent.press(screen.getByTestId('permissions-button'));

    expect(navigation.navigate).toHaveBeenCalledWith('ConsentCenter');
  });

  it('actually refetches when Try again is pressed after a failure', async () => {
    (getResults as jest.Mock)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(RESULTS);
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);
    await screen.findByText(/couldn't load your results/i);

    fireEvent.press(screen.getByText('Try again'));

    expect(await screen.findByText(SCREENING_DISCLAIMER)).toBeTruthy();
    expect(getResults).toHaveBeenCalledTimes(2);
  });
});

describe('ResultsScreen — free-text follow-up confirmations (issue #26)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearChildId.mockResolvedValue(undefined);
    (useSession as jest.Mock).mockReturnValue({
      familyId: 'f1',
      childId: 'c1',
      clearChildId,
    });
    (getResults as jest.Mock).mockResolvedValue({ ...RESULTS, redFlagTypes: [] });
    (getIntakeResponses as jest.Mock).mockResolvedValue([]);
    (getChild as jest.Mock).mockResolvedValue({
      id: 'c1',
      family_id: 'f1',
      nickname: 'Ava',
      age_band: 'toddler',
      languages: ['English'],
    });
  });

  it("renders the follow-up with the caregiver's own words and the child's name", async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([FOLLOW_UP_SUGGESTION]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByTestId('follow-up-card')).toBeTruthy();
    // Verbatim quote — reflection, never a paraphrase.
    expect(screen.getByText(/he stopped speaking last month/)).toBeTruthy();
    // Content-authored wording with [child] replaced by the nickname.
    expect(screen.getByText(/has Ava lost words or skills/)).toBeTruthy();
    // All three closed choices, labelled from content — never a yes-only trap.
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-yes')).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-no')).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-not_sure')).toBeTruthy();
    expect(screen.getByText("I'm not sure")).toBeTruthy();
  });

  it('confirming yes submits the structured answer and shows the recomputed results', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([FOLLOW_UP_SUGGESTION]);
    (answerFollowUpSuggestion as jest.Mock).mockResolvedValue({
      ...RESULTS,
      redFlagTypes: ['loss_of_skills'],
    });
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);
    await screen.findByTestId('follow-up-card');
    expect(
      screen.queryByText(/may benefit from being seen soon by a doctor/i),
    ).toBeNull();

    fireEvent.press(screen.getByTestId('follow-up-FU_loss_of_skills-yes'));

    // The red flag came from the recomputed deterministic results, not from the AI.
    expect(
      await screen.findByText(/may benefit from being seen soon by a doctor/i),
    ).toBeTruthy();
    expect(answerFollowUpSuggestion).toHaveBeenCalledWith('c1', 'suggestion-1', 'yes');
    // Answered — the question is gone.
    expect(screen.queryByTestId('follow-up-card')).toBeNull();
  });

  it('no consent / analysis unavailable (403) -> no card, results render normally', async () => {
    (analyzeResponses as jest.Mock).mockRejectedValue(
      new ApiError(403, { message: 'requires ai_analysis consent' }),
    );
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    expect(await screen.findByText(SCREENING_DISCLAIMER)).toBeTruthy();
    expect(screen.queryByTestId('follow-up-card')).toBeNull();
    expect(screen.queryByText(/couldn't load your results/i)).toBeNull();
  });

  it('no suggestions -> no card at all', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([]);
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);

    await screen.findByText(SCREENING_DISCLAIMER);
    expect(screen.queryByTestId('follow-up-card')).toBeNull();
  });

  it('a failed answer keeps the question and shows a gentle retryable message', async () => {
    (analyzeResponses as jest.Mock).mockResolvedValue([FOLLOW_UP_SUGGESTION]);
    (answerFollowUpSuggestion as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<ResultsScreen navigation={navProp()} route={{} as never} />);
    await screen.findByTestId('follow-up-card');

    fireEvent.press(screen.getByTestId('follow-up-FU_loss_of_skills-yes'));

    expect(await screen.findByText(/couldn't save that answer/i)).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-yes')).toBeTruthy();
  });
});
