import { render, screen } from '@testing-library/react-native';
import { SteppingStones } from './SteppingStones';

describe('SteppingStones', () => {
  it('renders one stone per step, split into done / current / ahead', () => {
    render(<SteppingStones total={10} currentIndex={3} />);
    expect(screen.getAllByTestId('stone-done')).toHaveLength(3);
    expect(screen.getAllByTestId('stone-current')).toHaveLength(1);
    expect(screen.getAllByTestId('stone-ahead')).toHaveLength(6);
  });

  it('announces progress to screen readers as "Step X of N"', () => {
    render(<SteppingStones total={26} currentIndex={12} />);
    expect(screen.getByLabelText('Step 13 of 26')).toBeTruthy();
  });

  it('exposes aria-valuenow/min/max so progress percentage is announced (#35)', () => {
    render(<SteppingStones total={26} currentIndex={12} />);
    const bar = screen.getByTestId('stepping-stones');
    expect(bar.props['aria-valuemin']).toBe(0);
    expect(bar.props['aria-valuemax']).toBe(26);
    expect(bar.props['aria-valuenow']).toBe(12);
  });

  it('clamps aria-valuenow to the total on the review step (never over 100%)', () => {
    render(<SteppingStones total={5} currentIndex={7} />);
    const bar = screen.getByTestId('stepping-stones');
    expect(bar.props['aria-valuenow']).toBe(5);
  });

  it('clamps a past-the-end index (review step) to a fully-filled path', () => {
    render(<SteppingStones total={5} currentIndex={5} />);
    expect(screen.getAllByTestId('stone-done')).toHaveLength(5);
    expect(screen.queryByTestId('stone-ahead')).toBeNull();
  });

  it('renders crossed-but-unanswered stones as skipped, not done (#37)', () => {
    render(
      <SteppingStones
        total={5}
        currentIndex={3}
        answered={[true, false, true, false, false]}
      />,
    );
    expect(screen.getAllByTestId('stone-done')).toHaveLength(2); // steps 0 and 2
    expect(screen.getAllByTestId('stone-skipped')).toHaveLength(1); // step 1
    expect(screen.getAllByTestId('stone-current')).toHaveLength(1);
    expect(screen.getAllByTestId('stone-ahead')).toHaveLength(1);
  });

  it('shows no filled stones on the review step when everything was skipped (#37)', () => {
    render(
      <SteppingStones total={5} currentIndex={5} answered={new Array(5).fill(false)} />,
    );
    expect(screen.queryByTestId('stone-done')).toBeNull();
    expect(screen.getAllByTestId('stone-skipped')).toHaveLength(5);
  });

  it('renders nothing for an empty path', () => {
    render(<SteppingStones total={0} currentIndex={0} />);
    expect(screen.queryByTestId('stepping-stones')).toBeNull();
  });
});
