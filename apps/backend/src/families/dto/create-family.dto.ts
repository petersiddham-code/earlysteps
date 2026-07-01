import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Consent is deliberately NOT settable here — product plan Screens 2-3 order the Consent
 * Center before Child Profile Setup, and CLAUDE.md §2 rule 9 wants consent "freshly-given,"
 * not bundled into account creation. Grant it via PATCH /families/:familyId/consent after.
 */
export class CreateFamilyDto {
  @IsString()
  @MinLength(2)
  locale!: string;

  @IsOptional()
  @IsBoolean()
  low_bandwidth_mode?: boolean;
}
