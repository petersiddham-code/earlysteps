import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaAuthRepository } from './prisma-auth.repository.js';
import { AUTH_REPOSITORY } from './auth.repository.js';
import { getJwtExpiresIn, getJwtSecret } from './jwt-config.js';

@Module({
  imports: [
    PassportModule,
    // Production MUST set JWT_SECRET (see apps/backend/.env.example) — the dev-only
    // fallback in getJwtSecret() must never run there.
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: getJwtExpiresIn() },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
  ],
})
export class AuthModule {}
