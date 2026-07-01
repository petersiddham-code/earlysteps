import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * `answer` is validated only as "present" (string | string[] | number, per
 * @earlysteps/shared-types IntakeResponse). Deeper per-question shape validation is a
 * follow-up — an unrecognized answer shape is already handled safely by the scoring engine
 * (it simply contributes 0, never throws), so this is not a safety gap, just an omission.
 */
class IntakeResponseItemDto {
  @IsString()
  @IsNotEmpty()
  question_id!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsNotEmpty()
  answer!: string | string[] | number;

  @IsISO8601()
  timestamp!: string;
}

export class SubmitIntakeResponsesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IntakeResponseItemDto)
  responses!: IntakeResponseItemDto[];
}
