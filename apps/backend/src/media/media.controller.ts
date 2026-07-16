import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MediaAsset, MediaAssetView } from '@earlysteps/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PremiumTierGuard } from '../auth/premium-tier.guard.js';
import { FamilyOwnershipGuard } from '../families/family-ownership.guard.js';
import { MediaService } from './media.service.js';
import { UploadMediaDto } from './dto/upload-media.dto.js';

/**
 * Multer's in-memory file shape, typed locally rather than pulling in @types/multer for
 * the four fields this controller actually reads (multer itself ships with
 * @nestjs/platform-express — no new runtime dependency).
 */
interface UploadedMediaFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** Videos are the biggest capture; anything past this is a client bug, not an observation. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Strips server-internal fields (storageKey, consentId) before a response leaves the
 * backend — data minimization (security review, issue #134). */
function toView(asset: MediaAsset): MediaAssetView {
  return {
    id: asset.id,
    childId: asset.childId,
    kind: asset.kind,
    mimeType: asset.mimeType,
    capturedAt: asset.capturedAt,
    retentionExpiresAt: asset.retentionExpiresAt,
    retainedByParent: asset.retainedByParent,
    deletedAt: asset.deletedAt,
  };
}

/**
 * Media capture endpoints (issue #134). Same guard combo as AnalysisController: media
 * capture is a logged-in, Premium feature (issue #123 gated the consent toggle in the
 * mobile UI; this closes the backend half), and a Premium account still can't reach a
 * child under a different account's family. media_capture consent itself is enforced in
 * MediaService (CLAUDE.md §2 rule 9) — a granted toggle is checked per upload, and a
 * fresh consentId records that verification on the stored asset.
 */
@UseGuards(JwtAuthGuard, PremiumTierGuard, FamilyOwnershipGuard)
@Controller('children/:childId/media')
export class MediaController {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(MediaService) private readonly mediaService: MediaService,
  ) {}

  /** Multipart upload: the captured file plus { kind, capturedAt? } fields (403 without
   * media_capture consent — nothing is written in that case). */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @Param('childId') childId: string,
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body() dto: UploadMediaDto,
  ): Promise<MediaAssetView> {
    if (!file || file.size === 0) {
      throw new BadRequestException('Expected a media file in the "file" field.');
    }
    const asset = await this.mediaService.upload(childId, {
      kind: dto.kind,
      mimeType: file.mimetype,
      data: file.buffer,
      capturedAt: dto.capturedAt,
    });
    return toView(asset);
  }

  /** The child's stored (non-deleted) media, newest capture first. */
  @Get()
  async list(@Param('childId') childId: string): Promise<MediaAssetView[]> {
    const assets = await this.mediaService.list(childId);
    return assets.map(toView);
  }

  /** Parent-initiated delete-now: real deletion of blob + record, ahead of the 90-day sweep. */
  @Delete(':mediaId')
  @HttpCode(204)
  async remove(
    @Param('childId') childId: string,
    @Param('mediaId') mediaId: string,
  ): Promise<void> {
    await this.mediaService.deleteNow(childId, mediaId);
  }
}
