import Constants from 'expo-constants';
import { getApiBaseUrl } from './config';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: undefined } },
}));

describe('getApiBaseUrl', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    (Constants as { expoConfig?: { hostUri?: string } }).expoConfig = {
      hostUri: undefined,
    };
  });

  it('prefers EXPO_PUBLIC_API_URL when set', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('derives from the Metro dev-server host when no env var is set', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    (Constants as { expoConfig?: { hostUri?: string } }).expoConfig = {
      hostUri: '192.168.1.42:8081',
    };
    expect(getApiBaseUrl()).toBe('http://192.168.1.42:3000');
  });

  it('falls back to localhost when neither env var nor hostUri is available', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    (Constants as { expoConfig?: { hostUri?: string } }).expoConfig = {
      hostUri: undefined,
    };
    expect(getApiBaseUrl()).toBe('http://localhost:3000');
  });
});
