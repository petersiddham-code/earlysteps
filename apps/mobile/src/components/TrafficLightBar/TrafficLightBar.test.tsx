import { render, screen } from '@testing-library/react-native';
import { TrafficLightBar } from './TrafficLightBar';

describe('TrafficLightBar', () => {
  it('renders the on-list label for a low level, never a number', () => {
    render(<TrafficLightBar domain="social" level="low" confidence="medium" />);
    expect(screen.getByText(/Low signs observed/)).toBeTruthy();
  });

  it('renders the on-list label for a many level', () => {
    render(<TrafficLightBar domain="communication" level="many" confidence="high" />);
    expect(screen.getByText(/Many signs observed/)).toBeTruthy();
  });

  it('always renders a confidence alongside the level (CLAUDE.md §2 rule 3)', () => {
    render(<TrafficLightBar domain="sensory" level="some" confidence="low" />);
    expect(screen.getByText(/low confidence/)).toBeTruthy();
  });

  it('renders the respectful domain display name, not the raw domain key', () => {
    render(
      <TrafficLightBar domain="repetitive_behaviour" level="low" confidence="high" />,
    );
    expect(screen.getByText('repetitive/self-regulating behaviours')).toBeTruthy();
    expect(screen.queryByText('repetitive_behaviour')).toBeNull();
  });

  it('renders the "not enough information yet" state with NO sign-level label (issue #22)', () => {
    render(<TrafficLightBar domain="social" level="insufficient_evidence" />);
    expect(screen.getByText('Not enough information yet')).toBeTruthy();
    // No traffic-light claim and no confidence may leak from too few answers.
    expect(screen.queryByText(/signs observed/i)).toBeNull();
    expect(screen.queryByText(/confidence/i)).toBeNull();
  });

  // CLAUDE.md §6: confidence rendering was extracted into <ConfidenceBadge/> once Assessment
  // B shipped, so both engines report confidence with the same visual language. Regression
  // guard that the delegation didn't silently drop the confidence text.
  it('delegates confidence rendering to ConfidenceBadge', () => {
    render(<TrafficLightBar domain="attention" level="some" confidence="high" />);
    expect(screen.getByText('high confidence')).toBeTruthy();
  });
});
