import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Also applied to AnalysisController (issue #76), paired with PremiumTierGuard, to close
 * the backend enforcement gap in docs/clinical-review/content-gaps.md §6(c).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
