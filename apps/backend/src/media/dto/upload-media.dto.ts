import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { MEDIA_KINDS, type MediaKind } from '@earlysteps/shared-types';

/** Multipart fields accompanying the uploaded file (issue #134). */
export class UploadMediaDto {
  @IsIn(MEDIA_KINDS)
  kind!: MediaKind;

  /** Capture time on the device — optional; the server clamps anything in the future. */
  @IsOptional()
  @IsISO8601()
  capturedAt?: string;
}
