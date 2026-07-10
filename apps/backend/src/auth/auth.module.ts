import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PrismaAuthRepository } from './prisma-auth.repository.js';
import { AUTH_REPOSITORY } from './auth.repository.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      // Falls back to a fixed dev-only value so local/test runs don't need a .env entry;
      // production MUST set JWT_SECRET (see apps/backend/.env.example).
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
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
