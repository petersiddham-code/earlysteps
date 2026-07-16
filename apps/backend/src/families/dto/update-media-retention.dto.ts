import { IsIn } from 'class-validator';
import {
  MEDIA_RETENTION_DAY_OPTIONS,
  type MediaRetentionDays,
} from '@earlysteps/shared-types';

/**
 * Parent-facing media retention window (issue #142, product plan §5 item 13). Shorter-only:
 * only the fixed 30/60/90 options are accepted, matching MEDIA_RETENTION_DAY_OPTIONS.
 */
export class UpdateMediaRetentionDto {
  @IsIn(MEDIA_RETENTION_DAY_OPTIONS)
  days!: MediaRetentionDays;
}
