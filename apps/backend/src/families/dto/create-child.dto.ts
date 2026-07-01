import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { AGE_BANDS } from '@earlysteps/shared-types';

export class CreateChildDto {
  @IsString()
  @IsNotEmpty()
  nickname!: string;

  @IsIn(AGE_BANDS)
  age_band!: (typeof AGE_BANDS)[number];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  languages!: string[];
}
