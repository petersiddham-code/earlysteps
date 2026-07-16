import { uploadAsync } from 'expo-file-system/legacy';
import { apiClient } from './client';
import { deleteMedia, listMedia, uploadMedia } from './media';
import { createGuestChild } from '../guest/guestStore';

jest.mock('./client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getAuthToken: jest.fn(() => 'token-123'),
  ApiError: class ApiError extends Error {},
}));
jest.mock('./config', () => ({ getApiBaseUrl: () => 'http://api.test' }));
// Native transfer module — mocked at the module boundary, like other Expo natives.
jest.mock('expo-file-system/legacy', () => ({
  uploadAsync: jest.fn(),
  FileSystemUploadType: { MULTIPART: 1 },
}));

function guestChildId(): string {
  return createGuestChild({
    family_id: 'f1',
    nickname: 'Alex',
    birth_month: 6,
    birth_year: 2024,
    age_band: 'toddler',
    languages: ['English'],
  }).id;
}

describe('media API wrappers (issue #134)', () => {
  afterEach(() => jest.clearAllMocks());

  it('uploadMedia sends a multipart background upload with the auth token', async () => {
    (uploadAsync as jest.Mock).mockResolvedValue({
      status: 201,
      body: JSON.stringify({ id: 'm1', kind: 'photo' }),
    });

    const asset = await uploadMedia({
      childId: 'c1',
      kind: 'photo',
      fileUri: 'file://photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(asset).toMatchObject({ id: 'm1', kind: 'photo' });
    expect(uploadAsync).toHaveBeenCalledWith(
      'http://api.test/children/c1/media',
      'file://photo.jpg',
      expect.objectContaining({
        httpMethod: 'POST',
        fieldName: 'file',
        mimeType: 'image/jpeg',
        parameters: expect.objectContaining({ kind: 'photo' }),
        headers: { authorization: 'Bearer token-123' },
      }),
    );
  });

  it('uploadMedia surfaces a non-2xx status (e.g. the 403 consent denial) as an error', async () => {
    (uploadAsync as jest.Mock).mockResolvedValue({
      status: 403,
      body: JSON.stringify({ message: 'consent required' }),
    });

    await expect(
      uploadMedia({
        childId: 'c1',
        kind: 'audio',
        fileUri: 'file://clip.m4a',
        mimeType: 'audio/m4a',
      }),
    ).rejects.toBeTruthy();
  });

  it('a guest child (#63) never reaches the network — no server record to attach media to', async () => {
    const id = guestChildId();

    expect(
      await uploadMedia({
        childId: id,
        kind: 'photo',
        fileUri: 'file://photo.jpg',
        mimeType: 'image/jpeg',
      }),
    ).toBeNull();
    expect(await listMedia(id)).toEqual([]);
    await deleteMedia(id, 'm1');

    expect(uploadAsync).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('listMedia gets the media route for a connected child', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue([]);
    await listMedia('c1');
    expect(apiClient.get).toHaveBeenCalledWith('/children/c1/media');
  });

  it('deleteMedia deletes the specific asset route for a connected child', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue(undefined);
    await deleteMedia('c1', 'm9');
    expect(apiClient.delete).toHaveBeenCalledWith('/children/c1/media/m9');
  });
});
