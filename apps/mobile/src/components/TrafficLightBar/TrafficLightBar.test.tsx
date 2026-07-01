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
});
