import { render, screen, fireEvent } from '@testing-library/react-native';
import type { AiResultsSummary } from '@earlysteps/shared-types';
import { AIAssessmentCard } from './AIAssessmentCard';

const SUMMARY: AiResultsSummary = {
  likelihood: 'Moderate',
  confidence: 'medium',
  reasoning: 'Several answers point toward reduced social reciprocity for their age.',
  developmentalProfile:
    'The overall pattern suggests social-communication differences alongside typical play interests.',
  strengths: ['Enjoys back-and-forth play with familiar adults'],
  supportPriorities: {
    immediate: [],
    short_term: [
      {
        priority: 'Shared picture-book time',
        reason: 'Builds on existing play enjoyment.',
      },
    ],
    medium_term: [],
    long_term: [],
  },
  uncertainty:
    'Only a few questions were answered this session, so this read is tentative.',
  uncertaintyFactors: ['sparse_structured_answers'],
  evidenceSummary:
    'The answers given lean toward limited spoken vocabulary for their age.',
  evidenceModalities: ['structured_answers'],
  homeRecommendations: ['Narrate daily routines out loud together'],
  schoolRecommendations: [],
  professionalAssessmentPriorities: [],
  generatedAt: '2026-07-12T00:00:00.000Z',
};

describe('AIAssessmentCard', () => {
  it('renders nothing when summary is null (fail closed, CLAUDE.md §8)', () => {
    render(<AIAssessmentCard summary={null} />);
    expect(screen.queryByTestId('ai-assessment-card')).toBeNull();
  });

  it('renders collapsed by default: toggle present, content not', () => {
    render(<AIAssessmentCard summary={SUMMARY} />);
    expect(screen.getByTestId('ai-assessment-card')).toBeTruthy();
    expect(screen.getByTestId('ai-assessment-toggle')).toBeTruthy();
    expect(screen.queryByTestId('ai-assessment-content')).toBeNull();
  });

  it('expands to show likelihood, confidence, and every populated section', () => {
    render(<AIAssessmentCard summary={SUMMARY} />);
    fireEvent.press(screen.getByTestId('ai-assessment-toggle'));

    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByText('medium confidence')).toBeTruthy();
    expect(screen.getByText(SUMMARY.reasoning)).toBeTruthy();
    expect(screen.getByText(SUMMARY.developmentalProfile)).toBeTruthy();
    expect(
      screen.getByText(/Enjoys back-and-forth play with familiar adults/),
    ).toBeTruthy();
    expect(screen.getByText(/Shared picture-book time/)).toBeTruthy();
    expect(screen.getByText(SUMMARY.uncertainty)).toBeTruthy();
    expect(screen.getByText('Sparse structured answers')).toBeTruthy();
    expect(screen.getByText(SUMMARY.evidenceSummary)).toBeTruthy();
    expect(screen.getByText(/Narrate daily routines out loud together/)).toBeTruthy();
  });

  // Rule 15 (§2): strengths must render before support priorities, structurally, not just
  // by convention — mirrors the DOM-order test <StrengthsFirstList/> already has.
  it('renders strengths before support priorities in the tree', () => {
    render(<AIAssessmentCard summary={SUMMARY} />);
    fireEvent.press(screen.getByTestId('ai-assessment-toggle'));

    // Both exist; strengths text must appear earlier in the rendered tree than the
    // support-priorities card — checked via position in the JSON tree.
    const tree = JSON.stringify(screen.toJSON());
    const strengthsPos = tree.indexOf('Enjoys back-and-forth play');
    const prioritiesPos = tree.indexOf('support-priorities-card');
    expect(strengthsPos).toBeGreaterThan(-1);
    expect(prioritiesPos).toBeGreaterThan(-1);
    expect(strengthsPos).toBeLessThan(prioritiesPos);
  });

  it('omits professional-assessment-priorities heading when the array is empty', () => {
    render(<AIAssessmentCard summary={SUMMARY} />);
    fireEvent.press(screen.getByTestId('ai-assessment-toggle'));
    expect(screen.queryByText('If seeking a professional assessment')).toBeNull();
  });

  it('renders professional-assessment-priorities when present (the one field permitted to)', () => {
    render(
      <AIAssessmentCard
        summary={{
          ...SUMMARY,
          professionalAssessmentPriorities: [
            'A comprehensive social-communication evaluation may help build a fuller picture.',
          ],
        }}
      />,
    );
    fireEvent.press(screen.getByTestId('ai-assessment-toggle'));
    expect(screen.getByText('If seeking a professional assessment')).toBeTruthy();
    expect(
      screen.getByText(
        /A comprehensive social-communication evaluation may help build a fuller picture\./,
      ),
    ).toBeTruthy();
  });
});
