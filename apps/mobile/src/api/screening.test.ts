import { apiClient } from './client';
import { getResults, submitIntakeResponses } from './screening';

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
});
