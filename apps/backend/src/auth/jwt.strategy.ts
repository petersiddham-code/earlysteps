import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { User } from '@earlysteps/shared-types';
import { AuthService } from './auth.service.js';
import { getJwtSecret } from './jwt-config.js';

interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(AuthService) private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // MUST match the secret JwtModule.register() signs with (auth.module.ts) — both read
      // getJwtSecret() so they can never drift apart (see jwt-config.ts).
      secretOrKey: getJwtSecret(),
    });
  }

  // Runs once the signature/expiry check passes; re-loads the user so a deleted/renamed
  // account can't keep authenticating off a stale, still-valid token.
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.authService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Account no longer exists.');
    return user;
  }
}
