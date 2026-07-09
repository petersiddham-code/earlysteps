import { apiClient } from './client';
import {
  createChild,
  createFamily,
  getChild,
  getFamily,
  updateConsent,
} from './families';
import { createGuestChild } from '../guest/guestStore';

jest.mock('./client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

describe('families API wrappers', () => {
  afterEach(() => jest.clearAllMocks());

  it('createFamily posts to /families with the input', async () => {
    await createFamily({ locale: 'en' });
    expect(apiClient.post).toHaveBeenCalledWith('/families', { locale: 'en' });
  });

  it('getFamily gets /families/:familyId', async () => {
    await getFamily('f1');
    expect(apiClient.get).toHaveBeenCalledWith('/families/f1');
  });

  it('updateConsent patches exactly one scope at a time', async () => {
    await updateConsent('f1', 'data_storage', true);
    expect(apiClient.patch).toHaveBeenCalledWith('/families/f1/consent', {
      scope: 'data_storage',
      granted: true,
    });
  });

  it('createChild posts under the family', async () => {
    await createChild('f1', {
      nickname: 'Alex',
      birth_month: 6,
      birth_year: 2024,
      languages: ['English'],
    });
    expect(apiClient.post).toHaveBeenCalledWith('/families/f1/children', {
      nickname: 'Alex',
      birth_month: 6,
      birth_year: 2024,
      languages: ['English'],
    });
  });

  it('getChild gets the nested child route', async () => {
    await getChild('f1', 'c1');
    expect(apiClient.get).toHaveBeenCalledWith('/families/f1/children/c1');
  });

  it('getChild reads the in-memory guest store instead of the network for a guest child (#63)', async () => {
    const guestChild = createGuestChild({
      family_id: 'f1',
      nickname: 'Alex',
      birth_month: 6,
      birth_year: 2024,
      age_band: 'toddler',
      languages: ['English'],
    });

    const result = await getChild('f1', guestChild.id);

    expect(result).toEqual(guestChild);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
