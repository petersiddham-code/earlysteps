import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import {
  USER_ROLES,
  USER_TIERS,
  type UserRole,
  type UserTier,
} from '@earlysteps/shared-types';

/**
 * Shape-level validation only. Whether the edit is actually allowed (self-demotion,
 * username already taken) is checked in AdminService.updateAccount against live account
 * state, not here.
 */
export class UpdateAdminAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'username may only contain letters, numbers, dots, underscores, and hyphens',
  })
  username?: string;

  @IsOptional()
  @IsIn(USER_TIERS)
  tier?: UserTier;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
