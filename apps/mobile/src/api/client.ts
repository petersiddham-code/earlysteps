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

/**
 * Issue #99: the only JwtAuthGuard-protected route today is `/auth/upgrade` — most
 * families/screening/analysis endpoints are still unauthenticated (see
 * docs/clinical-review/content-gaps.md §6). SessionContext calls this whenever the
 * in-session access token changes, so any guarded route this client calls carries it.
 */
let currentAccessToken: string | null = null;
export function setAuthToken(token: string | null): void {
  currentAccessToken = token;
}

/**
 * Issue #134: media uploads go through expo-file-system's uploadAsync (see api/media.ts)
 * rather than this fetch client, so they need the current token to build their own
 * Authorization header.
 */
export function getAuthToken(): string | null {
  return currentAccessToken;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['content-type'] = 'application/json';
  if (currentAccessToken) headers.authorization = `Bearer ${currentAccessToken}`;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
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
  // A 204 has no body — request() already tolerates that (json stays undefined).
  delete: (path: string) => request<void>('DELETE', path),
};
