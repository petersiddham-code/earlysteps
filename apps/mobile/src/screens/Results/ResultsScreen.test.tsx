import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ResultsScreen } from './ResultsScreen';
import { getIntakeResponses, getResults } from '../../api/index.js';
import { ApiError } from '../../api/client.js';
import { useSession } from '../../session/index.js';
import { SCREENING_DISCLAIMER } from '@earlysteps/shared-types';

jest.mock('../../api/index.js', () => ({
  getResults: jest.fn(),
  getIntakeResponses: jest.fn(),
}));
jest.mock('../../session/index.js', () => ({ useSession: jest.fn() }));

function navProp() {
  return { replace: jest.fn() } as unknown as Parameters<
    typeof ResultsScreen
  >[0]['navigation'];
}

const RESULTS = {
  disclaimer: SCREENING_DISCLAIMER,
  computedAt: '2026-07-01T00:00:00.000Z',
  domains: [
    {
      domain: 'social' as const,
      label: 'Many signs observed' as const,
      confidence: 'low' as const,
    },
    {
      domain: 'communication' as const,
      label: 'Low signs observed' as const,
      confidence: 'high' as const,
    },
  ],
  supportLevel: { term: 'high support needs' as const, confidence: 'low' as const },
  redFlagTypes: ['no_name_response' as const],
  recommendationTier: 'Formal assessment is recommended' as const,
};

describe('ResultsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({ childId: 'c1' });
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
