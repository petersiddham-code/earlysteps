import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { User } from '@earlysteps/shared-types';

/**
 * Must run after JwtAuthGuard, which populates `request.user` from a freshly-loaded
 * account (JwtStrategy re-reads the DB on every request, so tier is never stale — see
 * an upgrade taking effect without a new token). Closes the backend enforcement gap in
 * docs/clinical-review/content-gaps.md §6(c): previously only the mobile app's
 * canUseAiFeatures() kept a free/guest account off the LLM stage, so calling the API
 * directly could still reach it.
 */
@Injectable()
export class PremiumTierGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: User }>();
    if (user.tier !== 'premium') {
      throw new ForbiddenException('This feature requires a Premium account.');
    }
    return true;
  }
}
