#!/usr/bin/env bash
# Promotes the current state of `master` (in the main dev checkout) to the `release`
# branch (in the separate worktree that's actually serving the tunnel-exposed app), then
# restarts the release backend/Metro processes so the change goes live.
#
# Dev and release are deliberately separate: separate directories (git worktrees sharing
# one repo), separate branches, separate Postgres databases. This script is the only
# sanctioned way data/code should flow from one to the other — never edit inside the
# release worktree directly.
#
# Tunnel URLs are read from the running cloudflared logs each time, not hardcoded, since
# a free/account-less quick tunnel gets a new URL every time it's restarted.
set -euo pipefail

DEV_DIR="/Users/mamta/dev/earlysteps"
RELEASE_DIR="/Users/mamta/dev/earlysteps-release"
BACKEND_PORT=3000
METRO_PORT=8081
BACKEND_TUNNEL_LOG="/tmp/cf-backend.log"
WEB_TUNNEL_LOG="/tmp/cf-web.log"
BACKEND_LOG="/tmp/backend-release.log"
METRO_LOG="/tmp/metro-release.log"

log() { echo "[promote-to-release] $*"; }
fail() { echo "[promote-to-release] ERROR: $*" >&2; exit 1; }

[ -d "$RELEASE_DIR" ] || fail "release worktree not found at $RELEASE_DIR — see docs/clinical-review or ask Claude to recreate it."

# --- 1. Safety: both checkouts must be clean before touching anything ---
cd "$DEV_DIR"
[ -z "$(git status --porcelain)" ] || fail "dev directory ($DEV_DIR) has uncommitted changes — commit or stash first."
CURRENT_BRANCH=$(git branch --show-current)
[ "$CURRENT_BRANCH" = "master" ] || log "warning: dev directory is on '$CURRENT_BRANCH', not 'master' — promoting from master's tip regardless."

cd "$RELEASE_DIR"
[ -z "$(git status --porcelain)" ] || fail "release worktree ($RELEASE_DIR) has uncommitted changes — investigate before promoting; nothing should be edited there directly."

BEFORE_SHA=$(git rev-parse HEAD)

# --- 2. Fast-forward release to master's tip (shared .git, so master is already visible) ---
log "Fast-forwarding release -> master ($(git -C "$DEV_DIR" rev-parse --short master))..."
git merge --ff-only master || fail "release has diverged from master (non-fast-forward) — needs manual resolution, won't auto-merge."

AFTER_SHA=$(git rev-parse HEAD)
if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  log "Already up to date — nothing new to promote (still restarting services in case config/env changed)."
else
  log "Promoted $(git log --oneline "$BEFORE_SHA..$AFTER_SHA" | wc -l | tr -d ' ') commit(s):"
  git log --oneline "$BEFORE_SHA..$AFTER_SHA"
fi

# --- 3. Dependencies, Prisma client, and migrations — cheap enough to always run ---
log "Installing dependencies (shared pnpm store, should be fast)..."
pnpm install --silent

log "Applying any pending migrations to the release database..."
(cd "$RELEASE_DIR/apps/backend" && npx prisma migrate deploy)

log "Regenerating Prisma client..."
(cd "$RELEASE_DIR/apps/backend" && npx prisma generate) >/dev/null

# --- 4. Read the current tunnel URLs (may differ from last time if tunnels restarted) ---
BACKEND_TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$BACKEND_TUNNEL_LOG" 2>/dev/null | head -1 || true)
WEB_TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$WEB_TUNNEL_LOG" 2>/dev/null | head -1 || true)
[ -n "$BACKEND_TUNNEL_URL" ] || fail "couldn't find the backend tunnel URL in $BACKEND_TUNNEL_LOG — is cloudflared still running?"
log "Backend tunnel: $BACKEND_TUNNEL_URL"
[ -n "$WEB_TUNNEL_URL" ] && log "Web tunnel: $WEB_TUNNEL_URL"

# --- 5. Restart backend + Metro from the release worktree, same ports as before ---
BACKEND_PID=$(lsof -ti:"$BACKEND_PORT" || true)
[ -n "$BACKEND_PID" ] && { log "Stopping backend (pid $BACKEND_PID)..."; kill "$BACKEND_PID"; sleep 2; }

METRO_PID=$(lsof -ti:"$METRO_PORT" || true)
[ -n "$METRO_PID" ] && { log "Stopping Metro (pid $METRO_PID)..."; kill "$METRO_PID"; sleep 2; }

log "Starting backend from $RELEASE_DIR..."
(cd "$RELEASE_DIR/apps/backend" && nohup pnpm start:dev > "$BACKEND_LOG" 2>&1 &)
sleep 8

log "Starting Metro from $RELEASE_DIR (EXPO_PUBLIC_API_URL=$BACKEND_TUNNEL_URL)..."
(cd "$RELEASE_DIR/apps/mobile" && nohup env CI=1 EXPO_PUBLIC_API_URL="$BACKEND_TUNNEL_URL" pnpm exec expo start --port "$METRO_PORT" --clear > "$METRO_LOG" 2>&1 &)
sleep 15

# --- 6. Verify ---
BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$BACKEND_PORT/auth/register" -X POST -H "Content-Type: application/json" -d '{}' || echo "000")
METRO_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$METRO_PORT" || echo "000")
[ "$BACKEND_CODE" = "400" ] || fail "backend health check returned $BACKEND_CODE (expected 400 for an empty register body) — check $BACKEND_LOG"
[ "$METRO_CODE" = "200" ] || fail "Metro health check returned $METRO_CODE (expected 200) — check $METRO_LOG"

TUNNEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_TUNNEL_URL" || echo "000")
if [ "$TUNNEL_CODE" = "200" ]; then
  log "Verified end-to-end through the public web tunnel (200)."
else
  log "warning: local Metro is healthy, but the public web tunnel returned $TUNNEL_CODE — tunnel itself may need attention."
fi

log "Done. Release is now live at commit $(git rev-parse --short HEAD) — same public links as before."
