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
