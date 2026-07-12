import { render, screen } from '@testing-library/react-native';
import type { ComparisonResult } from '@earlysteps/shared-types';
import { ComparisonCard } from './ComparisonCard';

const AGREEMENT: ComparisonResult = {
  status: 'agreement',
  reasons: [],
  assessmentABand: 'low',
  assessmentBBand: 'low',
  bandDistance: 0,
  narrative:
    'The official screening result and this independent AI read point in the same general direction.',
  computedAt: '2026-07-12T00:00:00.000Z',
};

const DISAGREEMENT: ComparisonResult = {
  status: 'disagreement',
  reasons: ['low_confidence', 'insufficient_evidence'],
  assessmentABand: 'high',
  assessmentBBand: 'low',
  bandDistance: 2,
  narrative:
    'A specific serious-sign answer was given directly by the caregiver. That finding stands no matter what this comparison shows. The official screening result and this independent AI read point in noticeably different directions.',
  computedAt: '2026-07-12T00:00:00.000Z',
};

describe('ComparisonCard', () => {
  it('renders nothing when comparison is null (fail closed, CLAUDE.md §8)', () => {
    render(<ComparisonCard comparison={null} />);
    expect(screen.queryByTestId('comparison-card')).toBeNull();
  });

  it('renders the status label and narrative for agreement, with no reason tags', () => {
    render(<ComparisonCard comparison={AGREEMENT} />);
    expect(screen.getByTestId('comparison-card')).toBeTruthy();
    expect(screen.getByText('Agreement')).toBeTruthy();
    expect(screen.getByTestId('comparison-narrative')).toHaveTextContent(
      AGREEMENT.narrative,
    );
    expect(screen.queryByTestId('comparison-reasons')).toBeNull();
  });

  it('renders the status label, narrative (including the safety note), and reason tags for disagreement', () => {
    render(<ComparisonCard comparison={DISAGREEMENT} />);
    expect(screen.getByText('Disagreement')).toBeTruthy();
    expect(screen.getByTestId('comparison-narrative')).toHaveTextContent(
      /A specific serious-sign answer was given directly by the caregiver\./,
    );
    expect(screen.getByText('Low confidence')).toBeTruthy();
    expect(screen.getByText('Insufficient evidence')).toBeTruthy();
  });
});
