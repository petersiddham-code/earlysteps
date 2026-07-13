import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { User } from '@earlysteps/shared-types';
import { FAMILIES_REPOSITORY, type FamiliesRepository } from './families.repository.js';

interface OwnershipRequest {
  params: Record<string, string | undefined>;
  user?: User | null;
}

/**
 * Multi-tenancy boundary (issue #23), closing docs/clinical-review/content-gaps.md §6(b).
 * A family created before login existed, or by a guest session, has no owner (userId
 * null) and stays exactly as open as it is today — no regression for those callers. Once
 * a family IS linked to a User, only that account's JWT may read or write it (or a child
 * under it): no token gets 401, a different account's token gets 403.
 *
 * Must run after a guard that populates `request.user` (JwtAuthGuard or
 * OptionalJwtAuthGuard) — reads whatever's already there rather than authenticating
 * itself. Routes with neither a :familyId nor a :childId param (e.g. creating a brand-new
 * family) have nothing to check yet and are let through unconditionally.
 */
@Injectable()
export class FamilyOwnershipGuard implements CanActivate {
  constructor(
    @Inject(FAMILIES_REPOSITORY) private readonly repository: FamiliesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OwnershipRequest>();
    const { familyId, childId } = request.params;

    let ownerUserId: string | null | undefined;
    if (familyId) {
      ownerUserId = await this.repository.getFamilyOwnerUserId(familyId);
      if (ownerUserId === undefined) {
        throw new NotFoundException(`No family found with id ${familyId}`);
      }
    } else if (childId) {
      const child = await this.repository.getChild(childId);
      if (!child) throw new NotFoundException(`No child found with id ${childId}`);
      ownerUserId = await this.repository.getFamilyOwnerUserId(child.family_id);
    } else {
      return true;
    }

    if (!ownerUserId) return true; // Anonymous/guest family — unrestricted, as today.

    const user = request.user;
    if (!user) throw new UnauthorizedException('Please log in to access this family.');
    if (user.id !== ownerUserId) {
      throw new ForbiddenException("You don't have access to this family.");
    }
    return true;
  }
}
