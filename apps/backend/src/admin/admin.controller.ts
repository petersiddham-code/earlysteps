import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminAccountSummary,
  AdminClinicalReviewLogEntry,
  AdminContentDetail,
  AdminContentDraft,
  AdminContentSummary,
  User,
} from '@earlysteps/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AdminGuard } from './admin-role.guard.js';
import { AdminService } from './admin.service.js';
import { CreateContentDraftDto } from './dto/create-content-draft.dto.js';

/**
 * Issue #125, Admin Console v1: read-only ops dashboard + content/clinical-review-log
 * visibility. Issue #127 adds draft-only content editing (see admin-content-registry.ts
 * and docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md) — no route
 * here ever writes packages/content; a draft is a proposal, not a publish.
 */
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(AdminService) private readonly adminService: AdminService,
  ) {}

  @Get('accounts')
  listAccounts(): Promise<AdminAccountSummary[]> {
    return this.adminService.listAccounts();
  }

  @Get('content')
  getContentSummary(): AdminContentSummary {
    return this.adminService.getContentSummary();
  }

  @Get('clinical-review-log')
  getClinicalReviewLog(): AdminClinicalReviewLogEntry[] {
    return this.adminService.getClinicalReviewLog();
  }

  /** All open drafts, or those for one content key (?content_key=...). */
  @Get('content/drafts')
  listContentDrafts(
    @Query('content_key') contentKey?: string,
  ): Promise<AdminContentDraft[]> {
    return this.adminService.listContentDrafts(contentKey);
  }

  @Delete('content/drafts/:draftId')
  @HttpCode(204)
  discardContentDraft(@Param('draftId') draftId: string): Promise<void> {
    return this.adminService.discardContentDraft(draftId);
  }

  @Get('content/:contentKey')
  getContentDetail(@Param('contentKey') contentKey: string): AdminContentDetail {
    return this.adminService.getContentDetail(contentKey);
  }

  @Post('content/:contentKey/drafts')
  createContentDraft(
    @Param('contentKey') contentKey: string,
    @Body() dto: CreateContentDraftDto,
    @CurrentUser() user: User,
  ): Promise<AdminContentDraft> {
    return this.adminService.createContentDraft(
      contentKey,
      { field_path: dto.field_path, proposed_value: dto.proposed_value, note: dto.note },
      user.id,
    );
  }
}
