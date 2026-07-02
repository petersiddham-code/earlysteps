import { render, screen, fireEvent } from '@testing-library/react-native';
import { PrimaryButton } from './PrimaryButton';

describe('PrimaryButton', () => {
  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Continue" onPress={onPress} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Continue" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('replaces the label with a spinner and blocks presses while loading', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Save" onPress={onPress} loading testID="save-button" />);
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.press(screen.getByTestId('save-button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
