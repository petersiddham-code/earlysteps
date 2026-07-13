import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Same 'jwt' strategy as JwtAuthGuard, but never rejects the request for a missing or
 * invalid token — it just leaves `request.user` as null (issue #23). Lets a single route
 * serve both a guest caller (no Authorization header at all) and a logged-in one who
 * should be recognized as the owner of what they're creating/reading. Whether an anonymous
 * caller may actually proceed is decided downstream (e.g. FamilyOwnershipGuard), not here.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    return user ? user : null;
  }
}
