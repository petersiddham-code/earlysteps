import { IsBoolean, IsIn } from 'class-validator';
import { CONSENT_SCOPES } from '@earlysteps/shared-types';

/**
 * One scope per request — deliberately not a bulk-update body. Matches
 * <ConsentToggle/>'s one-scope-per-onChange UX and keeps "each togglable independently"
 * (product plan §4.7) true at the API boundary too, not just in the UI.
 */
export class UpdateConsentDto {
  @IsIn(CONSENT_SCOPES)
  scope!: (typeof CONSENT_SCOPES)[number];

  @IsBoolean()
  granted!: boolean;
}
