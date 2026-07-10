/**
 * Single source of truth for JWT secret/expiry — both JwtModule.register() (auth.module.ts,
 * used to SIGN tokens) and JwtStrategy (jwt.strategy.ts, used to VERIFY them) must agree on
 * these values, or every token fails signature verification. Read once from here rather than
 * each independently reading process.env, so the two can never drift apart.
 */
export function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-only-insecure-secret';
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? '7d';
}
