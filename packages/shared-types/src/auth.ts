/**
 * Account/auth model (issue #94). `User` is the PUBLIC shape returned by the API — it never
 * carries a password hash. `tier` exists now so premium-tier gating (the issue's stated
 * motivation — e.g. LLM suggestions) has somewhere to read from later; nothing enforces it
 * yet (see docs/clinical-review/content-gaps.md §6).
 *
 * `role` (issue #125) gates the Admin Console. There's no self-service way to become an
 * admin — see apps/backend/prisma/promote-to-admin.ts.
 */

export const USER_TIERS = ['free', 'premium'] as const;
export type UserTier = (typeof USER_TIERS)[number];

export const USER_ROLES = ['parent', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  username: string;
  tier: UserTier;
  role: UserRole;
  created_at: string;
}
