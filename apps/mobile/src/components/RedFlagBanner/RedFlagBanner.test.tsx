import { render, screen } from '@testing-library/react-native';
import { RED_FLAG_COPY } from '@earlysteps/content';
import { RedFlagBanner } from './RedFlagBanner';

describe('RedFlagBanner', () => {
  it('renders nothing when there are no red flags', () => {
    const { toJSON } = render(<RedFlagBanner redFlagTypes={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the calm base message for a non-urgent red flag', () => {
    render(<RedFlagBanner redFlagTypes={['no_name_response']} />);
    expect(screen.getByText(RED_FLAG_COPY.base_message)).toBeTruthy();
  });

  it('does not show the urgent resource block for a non-urgent flag', () => {
    render(<RedFlagBanner redFlagTypes={['no_name_response']} />);
    expect(screen.queryByText(RED_FLAG_COPY.urgent_resource_message)).toBeNull();
  });

  it('shows the additional urgent resource block for self_injury_risk', () => {
    render(<RedFlagBanner redFlagTypes={['self_injury_risk']} />);
    expect(screen.getByText(RED_FLAG_COPY.urgent_resource_message)).toBeTruthy();
  });

  it('shows the urgent block for safety_risk', () => {
    render(<RedFlagBanner redFlagTypes={['safety_risk']} />);
    expect(screen.getByText(RED_FLAG_COPY.urgent_resource_message)).toBeTruthy();
  });

  it('shows the urgent block when mixed with non-urgent flags', () => {
    render(<RedFlagBanner redFlagTypes={['no_name_response', 'self_injury_risk']} />);
    expect(screen.getByText(RED_FLAG_COPY.urgent_resource_message)).toBeTruthy();
  });
});
