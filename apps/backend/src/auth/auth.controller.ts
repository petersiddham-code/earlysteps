import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@earlysteps/shared-types';
import { AuthService, type AuthResult } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  /** Tighter than the app-wide default (app.module.ts) — an open internet-facing backend
   * shouldn't allow unlimited account-creation attempts from one source. */
  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto.username, dto.password);
  }

  /** Same reasoning as register — this is the actual brute-force target. */
  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  // Nest defaults POST handlers to 201 Created; login isn't creating anything, so it's 200.
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User): User {
    return user;
  }

  /**
   * Issue #99: self-service upgrade — no payment gateway exists yet, so this is a
   * deliberate stub (docs/clinical-review/content-gaps.md §6), one-directional
   * (free -> premium only).
   */
  @Patch('upgrade')
  @UseGuards(JwtAuthGuard)
  upgrade(@CurrentUser() user: User): Promise<User> {
    return this.authService.upgradeTier(user.id, 'premium');
  }
}
