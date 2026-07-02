import { render, screen, fireEvent } from '@testing-library/react-native';
import { QuestionRenderer } from './QuestionRenderer';
import type { Question } from '@earlysteps/shared-types';

const buttonsQuestion: Question = {
  id: 'T4',
  domain: 'social',
  age_band: 'toddler',
  text: 'When you call Alex from across the room, what usually happens?',
  type: 'buttons',
  options: [
    { id: 'looks_right_away', label: 'Looks or comes right away' },
    { id: 'doesnt_notice', label: "Doesn't seem to notice" },
  ],
  hint: 'Pick what happens most days.',
};

const multiSelectQuestion: Question = {
  id: 'T10',
  domain: 'repetitive_behaviour',
  age_band: 'toddler',
  text: 'Does Alex do the same movement over and over?',
  type: 'chip_multi_select',
  options: [
    { id: 'hand_flapping', label: 'Hand-flapping' },
    { id: 'rocking', label: 'Rocking' },
    { id: 'none', label: 'None of these' },
  ],
  hint: 'Pick all that apply.',
};

describe('QuestionRenderer', () => {
  it('renders the interpolated text and the interpolated hint', () => {
    render(
      <QuestionRenderer
        question={buttonsQuestion}
        text={buttonsQuestion.text}
        hint="Pick what happens with Alex most days."
        value={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(buttonsQuestion.text)).toBeTruthy();
    // The hint prop (already interpolated by the caller) wins over question.hint.
    expect(screen.getByText('Pick what happens with Alex most days.')).toBeTruthy();
    expect(screen.queryByText('Pick what happens most days.')).toBeNull();
  });

  it('single-select: calls onChange with the pressed option id, replacing any prior value', () => {
    const onChange = jest.fn();
    render(
      <QuestionRenderer
        question={buttonsQuestion}
        text={buttonsQuestion.text}
        hint={buttonsQuestion.hint}
        value="doesnt_notice"
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText('Looks or comes right away'));
    expect(onChange).toHaveBeenCalledWith('looks_right_away');
  });

  it('multi-select: adds an option that was not yet selected', () => {
    const onChange = jest.fn();
    render(
      <QuestionRenderer
        question={multiSelectQuestion}
        text={multiSelectQuestion.text}
        hint={multiSelectQuestion.hint}
        value={['rocking']}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText('Hand-flapping'));
    expect(onChange).toHaveBeenCalledWith(['rocking', 'hand_flapping']);
  });

  it('multi-select: removes an option that was already selected', () => {
    const onChange = jest.fn();
    render(
      <QuestionRenderer
        question={multiSelectQuestion}
        text={multiSelectQuestion.text}
        hint={multiSelectQuestion.hint}
        value={['rocking', 'hand_flapping']}
        onChange={onChange}
      />,
    );
    fireEvent.press(screen.getByText('Hand-flapping'));
    expect(onChange).toHaveBeenCalledWith(['rocking']);
  });
});
