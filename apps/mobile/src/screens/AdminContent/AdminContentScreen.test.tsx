import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdminContentScreen } from './AdminContentScreen';
import { getAdminContentSummary } from '../../api/index.js';

jest.mock('../../api/index.js', () => ({ getAdminContentSummary: jest.fn() }));

function navProp() {
  return {
    navigate: jest.fn(),
  } as unknown as Parameters<typeof AdminContentScreen>[0]['navigation'];
}

const SUMMARY = {
  question_banks: [
    { age_band: 'toddler', locale: 'en', version: '1.6.0', question_count: 26 },
    { age_band: 'young_adult', locale: 'en', version: '1.6.0', question_count: 16 },
  ],
  red_flag_copy_version: '1.1.0',
  red_flag_copy_needs_signoff: true,
};

describe('AdminContentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every question bank and the red-flag copy signoff status', async () => {
    (getAdminContentSummary as jest.Mock).mockResolvedValue(SUMMARY);
    render(<AdminContentScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-bank-toddler')).toBeTruthy(),
    );
    expect(screen.getByText('Young adult')).toBeTruthy();
    expect(screen.getByTestId('admin-red-flag-summary')).toHaveTextContent(
      'Red-flag copy v1.1.0Awaiting clinical sign-off',
    );
  });

  it('navigates into the field editor for a question bank, and lists every other content key', async () => {
    (getAdminContentSummary as jest.Mock).mockResolvedValue(SUMMARY);
    const navigation = navProp();
    render(<AdminContentScreen navigation={navigation} route={{} as never} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-bank-toddler')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('admin-content-bank-toddler'));
    expect(navigation.navigate).toHaveBeenCalledWith('AdminContentEdit', {
      contentKey: 'questions.toddler',
    });

    fireEvent.press(screen.getByTestId('admin-red-flag-summary'));
    expect(navigation.navigate).toHaveBeenCalledWith('AdminContentEdit', {
      contentKey: 'result-copy.red-flag-copy',
    });

    expect(screen.getByTestId('admin-content-other-result-copy.labels')).toBeTruthy();
    expect(screen.getByTestId('admin-content-other-domain-resources')).toBeTruthy();
    expect(screen.getByTestId('admin-content-other-follow-ups')).toBeTruthy();
    expect(screen.getByTestId('admin-content-other-consent.copy')).toBeTruthy();
    expect(
      screen.getByTestId('admin-content-other-ai-results-summary.copy'),
    ).toBeTruthy();
    expect(screen.getByTestId('admin-content-other-comparison.copy')).toBeTruthy();

    fireEvent.press(screen.getByTestId('admin-content-view-all-drafts'));
    expect(navigation.navigate).toHaveBeenCalledWith('AdminContentDrafts', {
      contentKey: undefined,
    });
  });

  it('shows an error state when content fails to load', async () => {
    (getAdminContentSummary as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<AdminContentScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't load content. Please try again."),
      ).toBeTruthy(),
    );
  });
});
