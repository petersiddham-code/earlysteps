import { render, screen } from '@testing-library/react-native';
import { SupportPrioritiesCard } from './SupportPrioritiesCard';

const HEADINGS = {
  heading: 'Support priorities',
  immediate: 'Right now',
  short_term: 'In the coming weeks',
  medium_term: 'In the coming months',
  long_term: 'Longer term',
};

describe('SupportPrioritiesCard', () => {
  it('renders null when every tier is empty', () => {
    render(
      <SupportPrioritiesCard
        priorities={{ immediate: [], short_term: [], medium_term: [], long_term: [] }}
        headings={HEADINGS}
      />,
    );
    expect(screen.queryByTestId('support-priorities-card')).toBeNull();
  });

  it('renders only the non-empty tiers', () => {
    render(
      <SupportPrioritiesCard
        priorities={{
          immediate: [{ priority: 'Reduce loud sounds', reason: 'Named as a trigger.' }],
          short_term: [],
          medium_term: [],
          long_term: [],
        }}
        headings={HEADINGS}
      />,
    );
    expect(screen.getByTestId('support-priorities-tier-immediate')).toBeTruthy();
    expect(screen.queryByTestId('support-priorities-tier-short_term')).toBeNull();
    expect(screen.getByText('Reduce loud sounds')).toBeTruthy();
    expect(screen.getByText('Named as a trigger.')).toBeTruthy();
  });

  it('renders all four tiers when populated', () => {
    render(
      <SupportPrioritiesCard
        priorities={{
          immediate: [{ priority: 'A', reason: 'a' }],
          short_term: [{ priority: 'B', reason: 'b' }],
          medium_term: [{ priority: 'C', reason: 'c' }],
          long_term: [{ priority: 'D', reason: 'd' }],
        }}
        headings={HEADINGS}
      />,
    );
    expect(screen.getByTestId('support-priorities-tier-immediate')).toBeTruthy();
    expect(screen.getByTestId('support-priorities-tier-short_term')).toBeTruthy();
    expect(screen.getByTestId('support-priorities-tier-medium_term')).toBeTruthy();
    expect(screen.getByTestId('support-priorities-tier-long_term')).toBeTruthy();
  });
});
