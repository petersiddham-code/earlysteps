import { render, screen } from '@testing-library/react-native';
import { StrengthsFirstList } from './StrengthsFirstList';

describe('StrengthsFirstList', () => {
  it('renders strengths before needs, even when needs contains more items', () => {
    const { toJSON } = render(
      <StrengthsFirstList
        strengths={['Loves music']}
        needs={['Needs support with transitions', 'Needs support with turn-taking']}
      />,
    );
    // React Native Testing Library doesn't expose DOM position directly; assert via the
    // underlying JSON tree order, which is what actually determines render order on device.
    const allText = JSON.stringify(toJSON());
    expect(allText.indexOf('Strengths')).toBeLessThan(allText.indexOf('Support needs'));
  });

  it('renders every strength and every need passed in', () => {
    render(
      <StrengthsFirstList
        strengths={['Loves music', 'Great memory']}
        needs={['Needs support with transitions']}
      />,
    );
    expect(screen.getByText('Loves music')).toBeTruthy();
    expect(screen.getByText('Great memory')).toBeTruthy();
    expect(screen.getByText('Needs support with transitions')).toBeTruthy();
  });

  it('still renders the strengths section (empty) even with zero strengths', () => {
    render(<StrengthsFirstList strengths={[]} needs={['Needs support with sleep']} />);
    expect(screen.getByText('Strengths')).toBeTruthy();
  });

  it('renders nothing at all when both lists are empty (#32)', () => {
    const { toJSON } = render(<StrengthsFirstList strengths={[]} needs={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders duplicate strengths/needs text without a React duplicate-key warning (#106)', () => {
    const warnSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <StrengthsFirstList
        strengths={[
          'She sometimes bites her arm when overwhelmed.',
          'She sometimes bites her arm when overwhelmed.',
        ]}
        needs={['Same note', 'Same note']}
      />,
    );
    const keyWarnings = warnSpy.mock.calls.filter((call) =>
      String(call[0]).includes('same key'),
    );
    expect(keyWarnings).toHaveLength(0);
    expect(
      screen.getAllByText('She sometimes bites her arm when overwhelmed.'),
    ).toHaveLength(2);
    expect(screen.getAllByText('Same note')).toHaveLength(2);
    warnSpy.mockRestore();
  });
});
