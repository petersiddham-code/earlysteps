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

  it('renders the same base message for an urgent red flag', () => {
    render(<RedFlagBanner redFlagTypes={['self_injury_risk']} />);
    expect(screen.getByText(RED_FLAG_COPY.base_message)).toBeTruthy();
  });

  it('does not carry the urgent crisis block — that lives in CrisisSupportCard (#50)', () => {
    render(<RedFlagBanner redFlagTypes={['self_injury_risk', 'safety_risk']} />);
    expect(screen.queryByText(RED_FLAG_COPY.urgent_resource_heading)).toBeNull();
    expect(screen.queryByText(RED_FLAG_COPY.urgent_resource_message)).toBeNull();
  });
});
