import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdminContentEditScreen } from './AdminContentEditScreen';
import { ApiError } from '../../api/client.js';
import { createAdminContentDraft, getAdminContentDetail } from '../../api/index.js';

jest.mock('../../api/index.js', () => ({
  createAdminContentDraft: jest.fn(),
  getAdminContentDetail: jest.fn(),
}));

function navProp() {
  return { navigate: jest.fn() } as unknown as Parameters<
    typeof AdminContentEditScreen
  >[0]['navigation'];
}

function routeProp() {
  return { params: { contentKey: 'result-copy.labels' } } as unknown as Parameters<
    typeof AdminContentEditScreen
  >[0]['route'];
}

const DETAIL = {
  content_key: 'result-copy.labels',
  fields: [
    { path: 'card_heading', label: 'card heading', current_value: 'Screening results' },
    {
      path: 'red_flag_confidence_note',
      label: 'red flag confidence note',
      current_value: 'This confidence comes from a direct answer.',
    },
  ],
};

describe('AdminContentEditScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists editable fields with their current live values', async () => {
    (getAdminContentDetail as jest.Mock).mockResolvedValue(DETAIL);
    render(<AdminContentEditScreen navigation={navProp()} route={routeProp()} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-field-card_heading')).toBeTruthy(),
    );
    expect(screen.getByText('Screening results')).toBeTruthy();
    expect(screen.getByTestId('admin-content-edit-banner')).toHaveTextContent(
      'never changes what families see',
      { exact: false },
    );
  });

  it('proposes an edit and shows it as drafted', async () => {
    (getAdminContentDetail as jest.Mock).mockResolvedValue(DETAIL);
    (createAdminContentDraft as jest.Mock).mockResolvedValue({
      id: 'draft-1',
      content_key: 'result-copy.labels',
      field_path: 'card_heading',
      current_value: 'Screening results',
      proposed_value: 'Your screening results',
      note: 'Friendlier heading.',
      created_by: 'an-admin',
      created_at: '2026-07-15T00:00:00.000Z',
      status: 'pending',
    });
    render(<AdminContentEditScreen navigation={navProp()} route={routeProp()} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-propose-card_heading')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('admin-content-propose-card_heading'));

    fireEvent.changeText(
      screen.getByTestId('admin-content-value-input-card_heading'),
      'Your screening results',
    );
    fireEvent.changeText(
      screen.getByTestId('admin-content-note-input-card_heading'),
      'Friendlier heading.',
    );
    fireEvent.press(screen.getByTestId('admin-content-submit-card_heading'));

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-drafted-card_heading')).toBeTruthy(),
    );
    expect(createAdminContentDraft).toHaveBeenCalledWith('result-copy.labels', {
      field_path: 'card_heading',
      proposed_value: 'Your screening results',
      note: 'Friendlier heading.',
    });
  });

  it('shows the server error (e.g. banned language) inline and keeps the field in edit mode', async () => {
    (getAdminContentDetail as jest.Mock).mockResolvedValue(DETAIL);
    (createAdminContentDraft as jest.Mock).mockRejectedValue(
      new ApiError(400, {
        message: 'proposed_value contains banned or reserved language.',
      }),
    );
    render(<AdminContentEditScreen navigation={navProp()} route={routeProp()} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-propose-card_heading')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('admin-content-propose-card_heading'));
    fireEvent.changeText(
      screen.getByTestId('admin-content-note-input-card_heading'),
      'Bad example.',
    );
    fireEvent.press(screen.getByTestId('admin-content-submit-card_heading'));

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-submit-error')).toHaveTextContent(
        'banned or reserved language',
        { exact: false },
      ),
    );
  });

  it('shows an error state when content fails to load', async () => {
    (getAdminContentDetail as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<AdminContentEditScreen navigation={navProp()} route={routeProp()} />);

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't load this content. Please try again."),
      ).toBeTruthy(),
    );
  });
});
