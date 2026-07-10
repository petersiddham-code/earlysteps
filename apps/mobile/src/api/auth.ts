import type { User } from '@earlysteps/shared-types';
import { apiClient } from './client.js';

export interface AuthResult {
  user: User;
  access_token: string;
}

export function register(username: string, password: string): Promise<AuthResult> {
  return apiClient.post<AuthResult>('/auth/register', { username, password });
}

export function login(username: string, password: string): Promise<AuthResult> {
  return apiClient.post<AuthResult>('/auth/login', { username, password });
}

/** Issue #99: self-service, one-directional (free -> premium) — see AuthController.upgrade. */
export function upgradeTier(): Promise<User> {
  return apiClient.patch<User>('/auth/upgrade');
}
