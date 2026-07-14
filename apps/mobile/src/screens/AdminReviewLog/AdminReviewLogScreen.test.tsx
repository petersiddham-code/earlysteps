import { render, screen, waitFor } from '@testing-library/react-native';
import { AdminReviewLogScreen } from './AdminReviewLogScreen';
import { getAdminClinicalReviewLog } from '../../api/index.js';

jest.mock('../../api/index.js', () => ({ getAdminClinicalReviewLog: jest.fn() }));

function navProp() {
  return {} as unknown as Parameters<typeof AdminReviewLogScreen>[0]['navigation'];
}

const ENTRY = {
  date: '2026-07-09',
  content_version: 'result-copy 1.3.0',
  what_changed: 'Confidence surfaced end-to-end.',
  advisor: 'Peter Siddham',
  status: '✅ signed off',
};

describe('AdminReviewLogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every sign-off log entry', async () => {
    (getAdminClinicalReviewLog as jest.Mock).mockResolvedValue([ENTRY]);
    render(<AdminReviewLogScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-review-log-row-0')).toBeTruthy(),
    );
    expect(screen.getByText('Confidence surfaced end-to-end.')).toBeTruthy();
    expect(screen.getByTestId('admin-review-log-row-0')).toHaveTextContent(
      '2026-07-09 · result-copy 1.3.0Confidence surfaced end-to-end.Peter Siddham — ✅ signed off',
    );
  });

  it('shows an error state when the log fails to load', async () => {
    (getAdminClinicalReviewLog as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<AdminReviewLogScreen navigation={navProp()} route={{} as never} />);

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't load the review log. Please try again."),
      ).toBeTruthy(),
    );
  });
});
