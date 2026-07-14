import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { User } from '@earlysteps/shared-types';
import { AdminGuard } from '../src/admin/admin-role.guard.js';

function contextWithUser(user: User): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

const baseUser: User = {
  id: 'user-1',
  username: 'someone',
  tier: 'free',
  role: 'parent',
  created_at: new Date().toISOString(),
};

describe('AdminGuard', () => {
  it('throws ForbiddenException for a parent account', () => {
    const guard = new AdminGuard();
    expect(() => guard.canActivate(contextWithUser(baseUser))).toThrow(
      ForbiddenException,
    );
  });

  it('allows an admin account through', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextWithUser({ ...baseUser, role: 'admin' }))).toBe(true);
  });
});
