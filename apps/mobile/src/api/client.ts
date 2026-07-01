import { getApiBaseUrl } from './config.js';

/**
 * Thrown for any non-2xx response. Carries the backend's Nest-shaped error body
 * ({ message, error, statusCode }) so callers can distinguish, e.g., a 403 consent denial
 * from a 400 validation error, without parsing strings.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { message?: string | string[]; error?: string } | undefined,
  ) {
    super(
      Array.isArray(body?.message)
        ? body.message.join(', ')
        : (body?.message ?? `Request failed with status ${status}`),
    );
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, json);
  }
  return json as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};
