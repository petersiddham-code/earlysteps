import { render, screen } from '@testing-library/react-native';
import { PersonalizedText, personalizeText } from './PersonalizedText';

describe('personalizeText', () => {
  it('replaces every [child] placeholder with the name', () => {
    expect(personalizeText('Does [child] wave when [child] sees you?', 'Sam')).toBe(
      'Does Sam wave when Sam sees you?',
    );
  });

  it('returns templates without a placeholder unchanged', () => {
    expect(personalizeText('Pick all that apply.', 'Sam')).toBe('Pick all that apply.');
  });
});

describe('PersonalizedText', () => {
  it('renders the full interpolated sentence', () => {
    render(<PersonalizedText template="What does [child] love doing most?" name="Sam" />);
    expect(screen.getByText('What does Sam love doing most?')).toBeTruthy();
  });

  it('renders the name as its own emphasized segment', () => {
    render(<PersonalizedText template="What does [child] love doing most?" name="Sam" />);
    const name = screen.getByText('Sam');
    expect(name).toBeTruthy();
    expect(name.props.style).toEqual(expect.objectContaining({ fontWeight: '700' }));
  });

  it('emphasizes every occurrence when the name appears more than once', () => {
    render(
      <PersonalizedText
        template="When [child] plays, does [child] look at you?"
        name="Sam"
      />,
    );
    expect(screen.getAllByText('Sam')).toHaveLength(2);
  });

  it('renders plain templates without inventing a name segment', () => {
    render(<PersonalizedText template="Pick all that apply." name="Sam" />);
    expect(screen.getByText('Pick all that apply.')).toBeTruthy();
    expect(screen.queryByText('Sam')).toBeNull();
  });
});
