import Constants from 'expo-constants';

/**
 * Resolves the backend base URL. Priority:
 *  1. EXPO_PUBLIC_API_URL — Expo exposes EXPO_PUBLIC_* env vars to client code automatically;
 *     set this for a real deploy or when the backend runs somewhere other than the dev host.
 *  2. Derived from the Metro dev-server host — `localhost` only resolves on a simulator, not a
 *     physical device running Expo Go, but the dev machine's LAN IP (what `hostUri` gives us)
 *     works from both, assuming the backend runs on the same machine as Metro during dev.
 *  3. `http://localhost:3000` as a last-resort fallback (web/simulator only).
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000`;
  }

  return 'http://localhost:3000';
}
