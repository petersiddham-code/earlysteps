import { apiClient } from './client';
import { getIntakeResponses, getResults, submitIntakeResponses } from './screening';
import { createGuestChild } from '../guest/guestStore';

jest.mock('./client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

describe('screening API wrappers', () => {
  afterEach(() => jest.clearAllMocks());

  it('submitIntakeResponses posts the responses array under the child', async () => {
    const responses = [
      {
        question_id: 'T1',
        domain: 'communication' as const,
        answer: 'before_12mo',
        timestamp: 't',
      },
    ];
    await submitIntakeResponses('c1', responses);
    expect(apiClient.post).toHaveBeenCalledWith('/children/c1/intake-responses', {
      responses,
    });
  });

  it('getResults gets the results route', async () => {
    await getResults('c1');
    expect(apiClient.get).toHaveBeenCalledWith('/children/c1/results');
  });

  it('getIntakeResponses gets the raw answer history route', async () => {
    await getIntakeResponses('c1');
    expect(apiClient.get).toHaveBeenCalledWith('/children/c1/intake-responses');
  });

  it('a guest child (#63) is scored on-device — no network call anywhere in the round trip', async () => {
    const guestChild = createGuestChild({
      family_id: 'f1',
      nickname: 'Alex',
      birth_month: 6,
      birth_year: 2024,
      age_band: 'toddler',
      languages: ['English'],
    });

    const view = await submitIntakeResponses(guestChild.id, [
      {
        question_id: 'T1',
        domain: 'communication' as const,
        answer: 'before_12mo',
        timestamp: 't',
      },
    ]);
    expect(view.basedOnAnswers).toBe(1);

    const fetchedView = await getResults(guestChild.id);
    expect(fetchedView).toEqual(view);

    const responses = await getIntakeResponses(guestChild.id);
    expect(responses).toHaveLength(1);

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
