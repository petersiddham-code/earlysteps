import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Shape-level validation only — whether `field_path` is actually draftable, and the
 * banned/reserved-language + length checks on `proposed_value`/`note`, happen in
 * AdminService.createContentDraft() against the live admin-content-registry.ts allowlist.
 */
export class CreateContentDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  field_path!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  proposed_value!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}
