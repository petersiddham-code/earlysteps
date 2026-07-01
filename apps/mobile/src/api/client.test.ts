import { apiClient, ApiError } from './client';

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('apiClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves with the parsed JSON body on a 2xx response', async () => {
    mockFetchOnce(201, { id: 'family-1', locale: 'en' });
    const result = await apiClient.post('/families', { locale: 'en' });
    expect(result).toEqual({ id: 'family-1', locale: 'en' });
  });

  it('sends the correct method, headers, and JSON body', async () => {
    mockFetchOnce(200, {});
    await apiClient.patch('/families/f1/consent', {
      scope: 'data_storage',
      granted: true,
    });

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(options.method).toBe('PATCH');
    expect(options.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ scope: 'data_storage', granted: true });
  });

  it('sends no body/content-type for a bodyless GET', async () => {
    mockFetchOnce(200, { id: 'family-1' });
    await apiClient.get('/families/family-1');

    const [, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(options.body).toBeUndefined();
    expect(options.headers).toBeUndefined();
  });

  it('throws ApiError with status and message on a non-2xx response', async () => {
    mockFetchOnce(403, {
      message:
        'Saving answers requires data-storage consent for this child. Please grant it first.',
      error: 'Forbidden',
      statusCode: 403,
    });

    await expect(
      apiClient.post('/children/x/intake-responses', {}),
    ).rejects.toMatchObject({
      status: 403,
      message:
        'Saving answers requires data-storage consent for this child. Please grant it first.',
    });
  });

  it('is an instance of ApiError specifically, so callers can distinguish it', async () => {
    mockFetchOnce(404, { message: 'No family found with id x' });
    await expect(apiClient.get('/families/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('joins an array of validation messages into one string', async () => {
    mockFetchOnce(400, {
      message: ['locale must be a string', 'locale should not be empty'],
      error: 'Bad Request',
    });

    await expect(apiClient.post('/families', {})).rejects.toMatchObject({
      message: 'locale must be a string, locale should not be empty',
    });
  });
});
