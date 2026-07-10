import { apiClient } from './client';
import { login, register } from './auth';

jest.mock('./client', () => ({
  apiClient: { post: jest.fn() },
}));

describe('auth API wrappers', () => {
  afterEach(() => jest.clearAllMocks());

  it('register posts to /auth/register with the credentials', async () => {
    await register('alex', 'password123');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
      username: 'alex',
      password: 'password123',
    });
  });

  it('login posts to /auth/login with the credentials', async () => {
    await login('alex', 'password123');
    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'alex',
      password: 'password123',
    });
  });
});
