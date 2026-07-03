import { render, screen, fireEvent } from '@testing-library/react-native';
import { CONSENT_SCOPES, type ConsentScope } from '@earlysteps/shared-types';
import { CONSENT_COPY } from '@earlysteps/content';
import { personalizeText } from '../PersonalizedText/PersonalizedText';
import { ConsentToggle } from './ConsentToggle';

describe('ConsentToggle', () => {
  it('renders the scope-specific label and explanation from content, not hardcoded', () => {
    render(<ConsentToggle scope="media_capture" value={false} onChange={() => {}} />);
    expect(screen.getByText(CONSENT_COPY.scopes.media_capture.label)).toBeTruthy();
    expect(screen.getByText(CONSENT_COPY.scopes.media_capture.explanation)).toBeTruthy();
  });

  it("resolves [child] to the child's name in the explanation (issue #36)", () => {
    render(
      <ConsentToggle
        scope="data_storage"
        value={false}
        onChange={() => {}}
        childName="Sam"
      />,
    );
    expect(
      screen.getByText(
        personalizeText(CONSENT_COPY.scopes.data_storage.explanation, 'Sam'),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/\[child\]/)).toBeNull();
  });

  it('falls back to "your child" before a child profile exists (onboarding order)', () => {
    render(<ConsentToggle scope="data_storage" value={false} onChange={() => {}} />);
    expect(
      screen.getByText(
        personalizeText(CONSENT_COPY.scopes.data_storage.explanation, 'your child'),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/\[child\]/)).toBeNull();
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
