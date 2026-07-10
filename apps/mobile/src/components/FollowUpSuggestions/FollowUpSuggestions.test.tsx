import { render, screen, fireEvent } from '@testing-library/react-native';
import { FollowUpSuggestions } from './FollowUpSuggestions';

const SUGGESTION = {
  id: 'suggestion-1',
  follow_up_id: 'FU_loss_of_skills',
  red_flag_type: 'loss_of_skills' as const,
  text: 'Thinking about what you wrote — has [child] lost words or skills they used to have?',
  hint: 'Only choose yes if that matches what you meant. Your answer here is what counts, not our reading of it.',
  source_question_id: 'T2',
  source_quote: 'stopped speaking',
};

describe('FollowUpSuggestions', () => {
  it('renders nothing when there are no suggestions', () => {
    const { toJSON } = render(
      <FollowUpSuggestions
        suggestions={[]}
        childName="Ava"
        answeringId={null}
        error={null}
        onAnswer={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
    expect(screen.queryByTestId('follow-up-card')).toBeNull();
  });

  it("shows the caregiver's own words, the content-authored question, and all three answers", () => {
    render(
      <FollowUpSuggestions
        suggestions={[SUGGESTION]}
        childName="Ava"
        answeringId={null}
        error={null}
        onAnswer={jest.fn()}
      />,
    );

    expect(screen.getByText(/stopped speaking/)).toBeTruthy();
    expect(screen.getByText(/has Ava lost words or skills/)).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-yes')).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-no')).toBeTruthy();
    expect(screen.getByTestId('follow-up-FU_loss_of_skills-not_sure')).toBeTruthy();
  });

  it('calls onAnswer with the suggestion and the chosen answer', () => {
    const onAnswer = jest.fn();
    render(
      <FollowUpSuggestions
        suggestions={[SUGGESTION]}
        childName="Ava"
        answeringId={null}
        error={null}
        onAnswer={onAnswer}
      />,
    );

    fireEvent.press(screen.getByTestId('follow-up-FU_loss_of_skills-yes'));

    expect(onAnswer).toHaveBeenCalledWith(SUGGESTION, 'yes');
  });

  it('disables every option while an answer is in flight', () => {
    render(
      <FollowUpSuggestions
        suggestions={[SUGGESTION]}
        childName="Ava"
        answeringId="suggestion-1"
        error={null}
        onAnswer={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId('follow-up-FU_loss_of_skills-yes').props.accessibilityState,
    ).toMatchObject({ disabled: true });
  });

  it('shows the error message when given one', () => {
    render(
      <FollowUpSuggestions
        suggestions={[SUGGESTION]}
        childName="Ava"
        answeringId={null}
        error="We couldn't save that answer. Please try again."
        onAnswer={jest.fn()}
      />,
    );

    expect(screen.getByText(/couldn't save that answer/i)).toBeTruthy();
  });
});
