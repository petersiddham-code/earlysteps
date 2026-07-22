import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { unsignedOffClinicalContent } from '@earlysteps/content';
import { AppModule } from './app.module.js';
import { assertClinicalContentSafeToBoot } from './startup/clinical-content-gate.js';

/**
 * Temporary traffic-visibility logging (dev-only, requested ad hoc while sharing this
 * backend through a public tunnel) — not request-scoped tracing, not for production.
 * `cf-connecting-ip` is the real client IP Cloudflare's edge attaches to every request,
 * even for an account-less quick tunnel; `x-forwarded-for` is the fallback for any other
 * proxy in front (or direct LAN access), and req.ip covers a same-machine request.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logTraffic(req: any, res: any, next: () => void) {
  const logger = new Logger('Traffic');
  const clientIp = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip;
  const start = Date.now();
  res.on('finish', () => {
    logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms — ${clientIp}`);
  });
  next();
}

async function bootstrap() {
  // Must run before anything else touches content — a production boot with unreviewed
  // clinical content (CLAUDE.md §9, issue #129) should never get far enough to listen.
  assertClinicalContentSafeToBoot(process.env.NODE_ENV, unsignedOffClinicalContent());

  const app = await NestFactory.create(AppModule);
  // Browser clients (Expo web in dev, and any future web build) are same-machine but
  // cross-origin (:8081 -> :3000), so without CORS every fetch is blocked at preflight.
  // CORS_ALLOWED_ORIGINS (comma-separated) restricts this to known origins once the
  // backend is actually reachable from the internet (set in the release/exposed
  // environment's .env — see the named-tunnel setup). Left unset, this still falls back
  // to wildcard-open, which is fine for a local-only dev backend nothing else can reach.
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors(allowedOrigins ? { origin: allowedOrigins } : {});
  app.use(logTraffic);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
