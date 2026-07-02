import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Browser clients (Expo web in dev, and any future web build) are same-machine but
  // cross-origin (:8081 -> :3000), so without CORS every fetch is blocked at preflight.
  // Reflecting the request origin is acceptable while the API is pre-auth and local-only;
  // tighten to an explicit allowlist when real deployment/auth lands.
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
