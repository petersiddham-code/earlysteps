import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type {
  AdminAccountSummary,
  AdminClinicalReviewLogEntry,
  AdminContentSummary,
} from '@earlysteps/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from './admin-role.guard.js';
import { AdminService } from './admin.service.js';

/**
 * Issue #125, Admin Console v1: read-only ops dashboard + content/clinical-review-log
 * visibility. No write endpoints here — content editing is deliberately deferred (it
 * would need the CLAUDE.md §9 clinical-review gate wired into the console workflow
 * itself, not just this PR).
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
}
