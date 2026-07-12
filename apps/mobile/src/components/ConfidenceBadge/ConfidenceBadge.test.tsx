import { render, screen } from '@testing-library/react-native';
import { ConfidenceBadge } from './ConfidenceBadge';

describe('ConfidenceBadge', () => {
  it('renders low confidence', () => {
    render(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText('low confidence')).toBeTruthy();
  });

  it('renders medium confidence', () => {
    render(<ConfidenceBadge confidence="medium" />);
    expect(screen.getByText('medium confidence')).toBeTruthy();
  });

  it('renders high confidence', () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText('high confidence')).toBeTruthy();
  });

  it('applies a testID when given, for both engines to key off (CLAUDE.md §6)', () => {
    render(<ConfidenceBadge confidence="medium" testID="assessment-b-confidence" />);
    expect(screen.getByTestId('assessment-b-confidence')).toBeTruthy();
  });
});
