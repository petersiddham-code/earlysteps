import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GENDER_OPTIONS } from '@earlysteps/shared-types';

/**
 * Unicode bidirectional control characters (LRM/RLM, LRE–PDF embedding, LRI–PDI
 * isolates). In a stored name they survive into every later render — reports, the
 * questionnaire, a clinician PDF — where RLO can visually reverse surrounding text, a
 * known spoofing vector (issue #38). Stripped, not rejected: a caregiver pasting a name
 * from an RTL keyboard shouldn't be punished for invisible characters they can't see.
 * ZWJ/ZWNJ are deliberately kept — they are load-bearing in correctly written Persian,
 * Devanagari, and other scripts our families actually use.
 */
const BIDI_CONTROL_CHARS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Strip BiDi controls and surrounding whitespace; leave non-strings for @IsString to reject. */
const sanitizeName = (value: unknown): unknown =>
  typeof value === 'string' ? value.replace(BIDI_CONTROL_CHARS, '').trim() : value;

/**
 * Child creation payload (issue #25): birth month + year replace the old manual
 * `age_band` selection — the band is derived server-side and returned on the Child
 * response, so consumers reading `age_band` keep working. Gender is optional and
 * inclusively worded; it is stored only (any use is gated clinical content).
 *
 * Range validation here is shape-level (a real calendar month, a plausible year); the
 * "is this child within the supported 12-month–25-year range" check lives in
 * FamiliesService, where it can compare against the current date and return a clear 400.
 *
 * Free-text fields are sanitized (trim + BiDi strip) BEFORE validation, so a
 * whitespace-only nickname fails @IsNotEmpty as an empty string (#38). Length caps are
 * generous for real names in any script; deliberately NO character allowlist — a
 * `\p{L}\p{N}`-style regex rejects combining marks and would lock out correctly written
 * Hindi and Arabic names, exactly the families this app serves.
 */
export class CreateChildDto {
  @Transform(({ value }) => sanitizeName(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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

  @Transform(({ value }) => sanitizeName(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  gender_detail?: string;

  @Transform(({ value }) => (Array.isArray(value) ? value.map(sanitizeName) : value))
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  languages!: string[];
}
