import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { resourcesForDomain } from '@earlysteps/content';
import { DomainResourcesCard } from './DomainResourcesCard';

describe('DomainResourcesCard', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('renders nothing when there are no needs domains', () => {
    const { toJSON } = render(<DomainResourcesCard domains={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders a section with resources for a domain with signs observed', () => {
    render(<DomainResourcesCard domains={['communication']} />);
    expect(screen.getByTestId('domain-resources-card')).toBeTruthy();
    for (const resource of resourcesForDomain('communication')) {
      expect(screen.getByTestId(`domain-resource-${resource.id}`)).toBeTruthy();
      expect(screen.getByText(resource.label)).toBeTruthy();
      expect(screen.getByText(resource.source)).toBeTruthy();
    }
  });

  it('renders one section per needs domain, in the given order', () => {
    render(<DomainResourcesCard domains={['communication', 'sensory']} />);
    for (const domain of ['communication', 'sensory'] as const) {
      for (const resource of resourcesForDomain(domain)) {
        expect(screen.getByTestId(`domain-resource-${resource.id}`)).toBeTruthy();
      }
    }
  });

  it('opens the resource URL with one tap', () => {
    render(<DomainResourcesCard domains={['communication']} />);
    const resource = resourcesForDomain('communication')[0];
    fireEvent.press(screen.getByTestId(`domain-resource-${resource.id}`));
    expect(openURL).toHaveBeenCalledWith(resource.value);
    expect(openURL).toHaveBeenCalledTimes(1);
  });

  it('marks each resource as an accessible link', () => {
    render(<DomainResourcesCard domains={['communication']} />);
    const resource = resourcesForDomain('communication')[0];
    expect(
      screen.getByTestId(`domain-resource-${resource.id}`).props.accessibilityRole,
    ).toBe('link');
  });
});
