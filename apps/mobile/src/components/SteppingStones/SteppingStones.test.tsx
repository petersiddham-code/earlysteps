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

  it('clamps a past-the-end index (review step) to a fully-filled path', () => {
    render(<SteppingStones total={5} currentIndex={5} />);
    expect(screen.getAllByTestId('stone-done')).toHaveLength(5);
    expect(screen.queryByTestId('stone-ahead')).toBeNull();
  });

  it('renders nothing for an empty path', () => {
    render(<SteppingStones total={0} currentIndex={0} />);
    expect(screen.queryByTestId('stepping-stones')).toBeNull();
  });
});
