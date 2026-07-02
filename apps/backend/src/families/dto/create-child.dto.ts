import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { GENDER_OPTIONS } from '@earlysteps/shared-types';

/**
 * Child creation payload (issue #25): birth month + year replace the old manual
 * `age_band` selection — the band is derived server-side and returned on the Child
 * response, so consumers reading `age_band` keep working. Gender is optional and
 * inclusively worded; it is stored only (any use is gated clinical content).
 *
 * Range validation here is shape-level (a real calendar month, a plausible year); the
 * "is this child within the supported 12-month–25-year range" check lives in
 * FamiliesService, where it can compare against the current date and return a clear 400.
 */
export class CreateChildDto {
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  birth_month!: number;

  @IsInt()
  @Min(1900)
  @Max(2200)
  birth_year!: number;

  @IsOptional()
  @IsIn(GENDER_OPTIONS)
  gender?: (typeof GENDER_OPTIONS)[number];

  @IsOptional()
  @IsString()
  gender_detail?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  languages!: string[];
}
