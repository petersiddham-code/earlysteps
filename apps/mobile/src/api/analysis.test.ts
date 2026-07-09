import { apiClient } from './client';
import { analyzeResponses } from './analysis';
import { createGuestChild } from '../guest/guestStore';

jest.mock('./client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

describe('analysis API wrappers', () => {
  afterEach(() => jest.clearAllMocks());

  it('analyzeResponses posts to the response-analysis route for a connected child', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue([]);
    await analyzeResponses('c1');
    expect(apiClient.post).toHaveBeenCalledWith('/children/c1/response-analysis');
  });

  it('a guest child (#63) never reaches the network — no follow-ups, same as ai_analysis off', async () => {
    const guestChild = createGuestChild({
      family_id: 'f1',
      nickname: 'Alex',
      birth_month: 6,
      birth_year: 2024,
      age_band: 'toddler',
      languages: ['English'],
    });

    const result = await analyzeResponses(guestChild.id);

    expect(result).toEqual([]);
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
