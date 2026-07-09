import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RED_FLAG_COPY } from '@earlysteps/content';
import { CrisisSupportCard, resourceHref } from './CrisisSupportCard';

describe('CrisisSupportCard', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('renders nothing when there are no red flags', () => {
    const { toJSON } = render(<CrisisSupportCard redFlagTypes={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing for non-urgent flags only (loss_of_skills, no_name_response)', () => {
    const { toJSON } = render(
      <CrisisSupportCard redFlagTypes={['loss_of_skills', 'no_name_response']} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the crisis block for self_injury_risk', () => {
    render(<CrisisSupportCard redFlagTypes={['self_injury_risk']} />);
    expect(screen.getByTestId('crisis-support-card')).toBeTruthy();
    expect(screen.getByText(RED_FLAG_COPY.urgent_resource_heading)).toBeTruthy();
    expect(screen.getByText(RED_FLAG_COPY.urgent_resource_message)).toBeTruthy();
  });

  it('renders the crisis block for safety_risk', () => {
    render(<CrisisSupportCard redFlagTypes={['safety_risk']} />);
    expect(screen.getByTestId('crisis-support-card')).toBeTruthy();
  });

  it('renders when urgent flags are mixed with non-urgent ones', () => {
    render(<CrisisSupportCard redFlagTypes={['loss_of_skills', 'self_injury_risk']} />);
    expect(screen.getByTestId('crisis-support-card')).toBeTruthy();
  });

  it('shows every configured resource as a tappable link with its label', () => {
    render(<CrisisSupportCard redFlagTypes={['self_injury_risk']} />);
    for (const resource of RED_FLAG_COPY.urgent_resources) {
      const target = screen.getByTestId(`crisis-resource-${resource.id}`);
      expect(target).toBeTruthy();
      expect(target.props.accessibilityRole).toBe('link');
      expect(screen.getByText(resource.label)).toBeTruthy();
    }
  });

  it('opens the resource target with one tap (product plan §10 rule 10)', () => {
    render(<CrisisSupportCard redFlagTypes={['self_injury_risk']} />);
    const resource = RED_FLAG_COPY.urgent_resources[0];
    fireEvent.press(screen.getByTestId(`crisis-resource-${resource.id}`));
    expect(openURL).toHaveBeenCalledWith(resourceHref(resource));
    expect(openURL).toHaveBeenCalledTimes(1);
  });

  it('builds a dialable tel: href (separators stripped) and passes URLs through', () => {
    expect(
      resourceHref({ id: 'x', kind: 'tel', value: '+91 98765-43210', label: 'Call' }),
    ).toBe('tel:+919876543210');
    expect(
      resourceHref({
        id: 'y',
        kind: 'url',
        value: 'https://findahelpline.com',
        label: 'Open',
      }),
    ).toBe('https://findahelpline.com');
  });
});
