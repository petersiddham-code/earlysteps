import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QuestionRenderer } from './QuestionRenderer';
import type { Question } from '@earlysteps/shared-types';

const buttonsQuestion: Question = {
  id: 'T4',
  domain: 'social',
  age_band: 'toddler',
  text: 'When you call [child] from across the room, what usually happens?',
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
  text: 'Does [child] do the same movement over and over?',
  type: 'chip_multi_select',
  options: [
    { id: 'hand_flapping', label: 'Hand-flapping' },
    { id: 'rocking', label: 'Rocking' },
    { id: 'none', label: 'None of these' },
  ],
  hint: 'Pick all that apply.',
};

const otherQuestion: Question = {
  id: 'U9',
  domain: 'strengths',
  age_band: 'universal',
  text: 'What does [child] love doing most?',
  type: 'chip_multi_select',
  options: [
    { id: 'music', label: 'Music' },
    { id: 'other', label: 'Other — type it' },
  ],
  hint: 'Pick all that apply.',
  allow_free_text: true,
};

function renderQuestion(
  question: Question,
  overrides: Partial<ComponentProps<typeof QuestionRenderer>> = {},
) {
  return render(
    <QuestionRenderer
      question={question}
      text={question.text}
      hint={question.hint}
      childName="Alex"
      value={undefined}
      onChange={() => {}}
      {...overrides}
    />,
  );
}

describe('QuestionRenderer', () => {
  it('renders text and hint with [child] replaced by the child name', () => {
    renderQuestion(buttonsQuestion, {
      hint: 'Pick what happens with [child] most days.',
    });
    expect(
      screen.getByText('When you call Alex from across the room, what usually happens?'),
    ).toBeTruthy();
    expect(screen.getByText('Pick what happens with Alex most days.')).toBeTruthy();
    expect(screen.queryByText('Pick what happens most days.')).toBeNull();
  });

  it("emphasizes the child's name as its own bold segment (issue #45)", () => {
    renderQuestion(buttonsQuestion);
    const name = screen.getByText('Alex');
    expect(name).toBeTruthy();
    expect(name.props.style).toEqual(expect.objectContaining({ fontWeight: '700' }));
  });

  it('single-select: calls onChange with the pressed option id, replacing any prior value', () => {
    const onChange = jest.fn();
    renderQuestion(buttonsQuestion, { value: 'doesnt_notice', onChange });
    fireEvent.press(screen.getByText('Looks or comes right away'));
    expect(onChange).toHaveBeenCalledWith('looks_right_away');
  });

  it('multi-select: adds an option that was not yet selected', () => {
    const onChange = jest.fn();
    renderQuestion(multiSelectQuestion, { value: ['rocking'], onChange });
    fireEvent.press(screen.getByText('Hand-flapping'));
    expect(onChange).toHaveBeenCalledWith(['rocking', 'hand_flapping']);
  });

  it('renders round radios for single-select and square checkboxes for multi-select', () => {
    const single = renderQuestion(buttonsQuestion);
    expect(single.getByTestId('option-radio-looks_right_away')).toBeTruthy();
    expect(single.queryByTestId('option-checkbox-looks_right_away')).toBeNull();
    single.unmount();

    renderQuestion(multiSelectQuestion, { value: ['rocking'] });
    expect(screen.getByTestId('option-checkbox-rocking')).toBeTruthy();
    expect(screen.queryByTestId('option-radio-rocking')).toBeNull();
    // Announced as a real checkbox with checked state for screen readers.
    expect(screen.getByRole('checkbox', { name: 'Rocking', checked: true })).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Hand-flapping', checked: false }),
    ).toBeTruthy();
  });

  it('multi-select: removes an option that was already selected', () => {
    const onChange = jest.fn();
    renderQuestion(multiSelectQuestion, {
      value: ['rocking', 'hand_flapping'],
      onChange,
    });
    fireEvent.press(screen.getByText('Hand-flapping'));
    expect(onChange).toHaveBeenCalledWith(['rocking']);
  });

  describe('keyboard + screen-reader access to checkboxes (issues #34, #35)', () => {
    it('Space toggles an unchecked checkbox on and consumes the key (no page scroll)', () => {
      const onChange = jest.fn();
      const preventDefault = jest.fn();
      renderQuestion(multiSelectQuestion, { value: ['rocking'], onChange });

      fireEvent(screen.getByRole('checkbox', { name: 'Hand-flapping' }), 'keyDown', {
        key: ' ',
        preventDefault,
      });

      expect(onChange).toHaveBeenCalledWith(['rocking', 'hand_flapping']);
      expect(preventDefault).toHaveBeenCalled();
    });

    it('Space toggles a checked checkbox off', () => {
      const onChange = jest.fn();
      renderQuestion(multiSelectQuestion, {
        value: ['rocking', 'hand_flapping'],
        onChange,
      });

      fireEvent(screen.getByRole('checkbox', { name: 'Rocking' }), 'keyDown', {
        key: ' ',
        preventDefault: () => {},
      });

      expect(onChange).toHaveBeenCalledWith(['hand_flapping']);
    });

    it('other keys do not toggle a checkbox', () => {
      const onChange = jest.fn();
      renderQuestion(multiSelectQuestion, { value: [], onChange });

      fireEvent(screen.getByRole('checkbox', { name: 'Rocking' }), 'keyDown', {
        key: 'a',
        preventDefault: () => {},
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('every checkbox exposes its name and checked state (aria-checked + label)', () => {
      renderQuestion(multiSelectQuestion, { value: ['hand_flapping'] });

      // getByRole resolves name from accessibilityLabel and state from aria-checked —
      // a nameless or stateless checkbox fails these queries.
      expect(
        screen.getByRole('checkbox', { name: 'Hand-flapping', checked: true }),
      ).toBeTruthy();
      expect(
        screen.getByRole('checkbox', { name: 'Rocking', checked: false }),
      ).toBeTruthy();
      expect(
        screen.getByRole('checkbox', { name: 'None of these', checked: false }),
      ).toBeTruthy();
    });

    it('single-select options stay role=button (Space already handled natively there)', () => {
      const onChange = jest.fn();
      renderQuestion(buttonsQuestion, { onChange });

      const button = screen.getByRole('button', { name: 'Looks or comes right away' });
      // No custom keydown wiring on buttons — react-native-web maps Space to press for
      // role="button" on its own, so a duplicate handler would double-toggle.
      fireEvent(button, 'keyDown', { key: ' ', preventDefault: () => {} });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('"Other — type it" inline input (issue #28)', () => {
    it('shows no inline input while "Other" is unchecked', () => {
      renderQuestion(otherQuestion, { value: ['music'], onOtherTextChange: () => {} });
      expect(screen.queryByTestId('other-input-U9')).toBeNull();
    });

    it('reveals an inline input when "Other" is checked and reports typing', () => {
      const onOtherTextChange = jest.fn();
      renderQuestion(otherQuestion, { value: ['other'], onOtherTextChange });
      const input = screen.getByTestId('other-input-U9');
      fireEvent.changeText(input, 'Portuguese');
      expect(onOtherTextChange).toHaveBeenCalledWith('Portuguese');
    });

    it('shows the current typed value inside the inline input', () => {
      renderQuestion(otherQuestion, {
        value: ['other'],
        otherText: 'Turkish',
        onOtherTextChange: () => {},
      });
      expect(screen.getByTestId('other-input-U9').props.value).toBe('Turkish');
    });

    it('keeps the generic free-text box independent of the inline other input', () => {
      renderQuestion(otherQuestion, {
        value: ['other'],
        freeText: '',
        onFreeTextChange: () => {},
        otherText: '',
        onOtherTextChange: () => {},
      });
      expect(screen.getByTestId('other-input-U9')).toBeTruthy();
      expect(screen.getByTestId('free-text-U9')).toBeTruthy();
    });
  });
});
