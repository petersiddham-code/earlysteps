import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { User } from '@earlysteps/shared-types';

/**
 * Must run after JwtAuthGuard (mandatory, not optional — the Admin Console never answers
 * to a guest session), which populates `request.user` from a freshly-loaded account (same
 * re-read-on-every-request guarantee PremiumTierGuard relies on, see jwt.strategy.ts).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: User }>();
    if (user.role !== 'admin') {
      throw new ForbiddenException('This feature requires an admin account.');
    }
    return true;
  }
}
