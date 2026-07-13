import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '@earlysteps/shared-types';

/** Reads `request.user` as populated by OptionalJwtAuthGuard — null for an anonymous/guest
 * caller, never throws (contrast CurrentUser, which assumes a mandatory JwtAuthGuard ran). */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const request = ctx.switchToHttp().getRequest<{ user: User | null }>();
    return request.user ?? null;
  },
);
