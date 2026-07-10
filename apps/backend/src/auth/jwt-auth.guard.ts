import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exported for future use gating premium-tier routes (the issue's stated motivation) — not
 * yet applied to any existing controller. See docs/clinical-review/content-gaps.md §6.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
