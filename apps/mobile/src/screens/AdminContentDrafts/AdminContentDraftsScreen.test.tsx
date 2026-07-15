import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdminContentDraftsScreen } from './AdminContentDraftsScreen';
import { discardAdminContentDraft, getAdminContentDrafts } from '../../api/index.js';

jest.mock('../../api/index.js', () => ({
  discardAdminContentDraft: jest.fn(),
  getAdminContentDrafts: jest.fn(),
}));

function routeProp(contentKey?: string) {
  return { params: { contentKey } } as unknown as Parameters<
    typeof AdminContentDraftsScreen
  >[0]['route'];
}

const DRAFT = {
  id: 'draft-1',
  content_key: 'result-copy.labels',
  field_path: 'card_heading',
  current_value: 'Screening results',
  proposed_value: 'Your screening results',
  note: 'Friendlier heading.',
  created_by: 'an-admin',
  created_at: '2026-07-15T00:00:00.000Z',
  status: 'pending' as const,
};

describe('AdminContentDraftsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders every pending draft with its current/proposed diff', async () => {
    (getAdminContentDrafts as jest.Mock).mockResolvedValue([DRAFT]);
    render(<AdminContentDraftsScreen navigation={{} as never} route={routeProp()} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-draft-draft-1')).toBeTruthy(),
    );
    expect(screen.getByText('Current: Screening results')).toBeTruthy();
    expect(screen.getByText('Proposed: Your screening results')).toBeTruthy();
    expect(getAdminContentDrafts).toHaveBeenCalledWith(undefined);
  });

  it('scopes the request to a content key when provided', async () => {
    (getAdminContentDrafts as jest.Mock).mockResolvedValue([]);
    render(
      <AdminContentDraftsScreen
        navigation={{} as never}
        route={routeProp('result-copy.labels')}
      />,
    );

    await waitFor(() =>
      expect(getAdminContentDrafts).toHaveBeenCalledWith('result-copy.labels'),
    );
    expect(await screen.findByTestId('admin-content-drafts-empty')).toBeTruthy();
  });

  it('discards a draft and removes it from the list', async () => {
    (getAdminContentDrafts as jest.Mock).mockResolvedValue([DRAFT]);
    (discardAdminContentDraft as jest.Mock).mockResolvedValue(undefined);
    render(<AdminContentDraftsScreen navigation={{} as never} route={routeProp()} />);

    await waitFor(() =>
      expect(screen.getByTestId('admin-content-draft-draft-1')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('admin-content-discard-draft-1'));

    await waitFor(() => expect(discardAdminContentDraft).toHaveBeenCalledWith('draft-1'));
    await waitFor(() =>
      expect(screen.queryByTestId('admin-content-draft-draft-1')).toBeNull(),
    );
  });

  it('shows an error state when drafts fail to load', async () => {
    (getAdminContentDrafts as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<AdminContentDraftsScreen navigation={{} as never} route={routeProp()} />);

    await waitFor(() =>
      expect(screen.getByText("We couldn't load drafts. Please try again.")).toBeTruthy(),
    );
  });
});
