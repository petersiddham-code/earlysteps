import { render, screen } from '@testing-library/react-native';
import { SCREENING_DISCLAIMER } from '@earlysteps/shared-types';
import { ScreeningDisclaimer } from './ScreeningDisclaimer';

describe('ScreeningDisclaimer', () => {
  it('renders the verbatim disclaimer text', () => {
    render(<ScreeningDisclaimer />);
    expect(screen.getByText(SCREENING_DISCLAIMER)).toBeTruthy();
  });

  it('does not accept a children/text prop that could override the wording', () => {
    // Type-level guarantee: ScreeningDisclaimerProps only has `style`. This test documents
    // the intent — TypeScript itself is the enforcement (see ScreeningDisclaimer.tsx props).
    render(<ScreeningDisclaimer style={{ padding: 4 }} />);
    expect(screen.getByText(SCREENING_DISCLAIMER)).toBeTruthy();
  });
});
