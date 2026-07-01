import { render, screen, fireEvent } from '@testing-library/react-native';
import { CONSENT_SCOPES, type ConsentScope } from '@earlysteps/shared-types';
import { CONSENT_COPY } from '@earlysteps/content';
import { ConsentToggle } from './ConsentToggle';

describe('ConsentToggle', () => {
  it('renders the scope-specific label and explanation from content, not hardcoded', () => {
    render(<ConsentToggle scope="media_capture" value={false} onChange={() => {}} />);
    expect(screen.getByText(CONSENT_COPY.scopes.media_capture.label)).toBeTruthy();
    expect(screen.getByText(CONSENT_COPY.scopes.media_capture.explanation)).toBeTruthy();
  });

  it('is a controlled component: reflects the value prop, not internal state', () => {
    render(<ConsentToggle scope="data_storage" value={true} onChange={() => {}} />);
    const toggle = screen.getByRole('switch');
    expect(toggle.props.value).toBe(true);
  });

  it('calls onChange when toggled, without mutating anything itself', () => {
    const onChange = jest.fn();
    render(<ConsentToggle scope="ai_analysis" value={false} onChange={onChange} />);
    fireEvent(screen.getByRole('switch'), 'valueChange', true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('has independent copy for every one of the four consent scopes (product plan §4.7)', () => {
    for (const scope of CONSENT_SCOPES) {
      const { unmount } = render(
        <ConsentToggle scope={scope as ConsentScope} value={false} onChange={() => {}} />,
      );
      expect(screen.getByText(CONSENT_COPY.scopes[scope].label)).toBeTruthy();
      unmount();
    }
  });
});
