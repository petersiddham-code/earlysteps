import { apiClient } from './client';
import {
  createChild,
  createFamily,
  getChild,
  getFamily,
  updateConsent,
} from './families';

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
});
