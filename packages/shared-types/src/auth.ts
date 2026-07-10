/**
 * Account/auth model (issue #94). `User` is the PUBLIC shape returned by the API — it never
 * carries a password hash. `tier` exists now so premium-tier gating (the issue's stated
 * motivation — e.g. LLM suggestions) has somewhere to read from later; nothing enforces it
 * yet (see docs/clinical-review/content-gaps.md §6).
 */

export const USER_TIERS = ['free', 'premium'] as const;
export type UserTier = (typeof USER_TIERS)[number];

export interface User {
  id: string;
  username: string;
  tier: UserTier;
  created_at: string;
}
