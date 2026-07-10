---
description: "Pick up a GitHub issue end-to-end: plan, branch, implement, verify live, open a PR — then hand over for manual testing (never merges)"
argument-hint: <issue-number>
---

# /issue — work a GitHub issue to a test-ready PR

You are picking up GitHub issue **#$ARGUMENTS** in `petersiddham-code/earlysteps`. Take it
from "open issue" to "PR ready for the user's manual test". **You never merge** — merging
and closing happen only via `/issue_close`, after the user has tested and explicitly asked.

## 0. Preconditions — stop early if anything is off

1. If `$ARGUMENTS` is not a single issue number, ask for one and stop.
2. `git status` must be clean and on `master`. If the tree is dirty, stop and tell the user
   what's uncommitted — never stash or discard someone's work silently. Then
   `git checkout master && git pull` so you branch from the latest merged state.
3. `gh issue view $ARGUMENTS --comments` — read the full issue INCLUDING comments (later
   comments often amend the request). If the issue doesn't exist or is already closed,
   report that and stop.
4. Check for existing work: `gh pr list --state all --search "$ARGUMENTS in:title,body"`
   and `git branch -a | grep "issue/$ARGUMENTS-"`. If a PR or branch for this issue already
   exists, do not start a duplicate — tell the user what exists and ask whether to resume
   it, replace it, or abort.

## 1. Understand and plan before touching code

1. Re-read `CLAUDE.md` sections relevant to the issue's area. The non-negotiables in §2 are
   shipped-safety-bug territory, not style.
2. Restate the issue in one or two sentences (what's broken / what's wanted, and what
   "done" looks like). If the issue is ambiguous on a decision that changes what you'd
   build, ask the user targeted questions FIRST — one round of questions is cheaper than a
   wrong implementation.
3. Explore the code the issue touches and write a short plan: files to change, tests to
   add, how you will verify it live.
4. **Clinical-content triage (CLAUDE.md §9):** if the work touches question wording,
   activity instructions, scoring weights/thresholds, red-flag trigger definitions, or
   result/report copy templates, this PR must (a) add a dated note in
   `docs/clinical-review/` describing what changed and why, (b) add a row to the
   `docs/clinical-review/README.md` sign-off log, and (c) be flagged in the PR body as
   **"clinical content change — needs advisor sign-off"**. Decide this NOW so it shapes the
   work, not as an afterthought.

## 2. Branch and implement

1. Branch: `git checkout -b issue/$ARGUMENTS-<short-kebab-slug>` (slug from the issue
   title, e.g. `issue/17-offline-retry-queue`).
2. Implement in the established architecture — content as versioned JSON in
   `packages/content` (never hardcoded strings), deterministic logic in
   `packages/scoring-engine`, shared types in `packages/shared-types`, and don't introduce
   new frameworks/libraries for something the stack already covers without asking.
3. Every behaviour change gets test coverage in the suite that owns it:
   - `packages/*` and backend: vitest (`pnpm test`)
   - mobile components/screens: jest (`pnpm test:mobile`)
   - safety-carrying code (scoring, red flags, consent gating, disclaimer/label rendering)
     gets the most thorough tests — it's the most safety-critical code in the repo.

## 3. Verify — automated gate, then live

1. Full automated gate, all green, from the repo root:
   `pnpm typecheck && pnpm lint && pnpm lint:content && pnpm test && pnpm test:mobile`
2. **Live verification is required, not optional** — the suite has repeatedly missed
   runtime-only failures (NestJS DI under tsx, Metro resolver cycles, CORS). Match the
   verification to the change:
   - Backend: run `pnpm start:dev` (needs local Postgres, see `apps/backend/.env`) and
     exercise the changed endpoints with real `curl` requests, including the failure paths
     (403 without consent, 404s, validation errors).
   - Mobile/UI: drive the real app in a browser — Metro via
     `CI=1 pnpm exec expo start --port 8081 --clear` (the `--clear` matters after adding
     content JSON modules) plus the backend, then a scripted headless-Chromium (Playwright)
     click-through of the affected flow with a fresh browser profile. At minimum verify the
     app boots with zero page errors and the changed screens render and behave.
   - Content-only: `pnpm lint:content` plus a live render of one screen that consumes it.
3. If verification finds a gap you are NOT fixing in this PR, don't hide it and don't
   silently work around it: record it (usually `docs/clinical-review/content-gaps.md`) and
   say so in the PR body.

## 4. Open the PR and hand over

1. Commit with a detailed message: what changed, WHY, what was verified and how, and any
   gaps/simplifications. End with the Claude co-author line.
2. Push and `gh pr create`. The PR body must include:
   - `Closes #$ARGUMENTS` (so the merge in `/issue_close` auto-closes the issue)
   - a summary of the change and any decisions taken
   - a test-plan checklist of what was actually run (automated + live), boxes checked
   - the clinical-content flag block from step 1.4, if applicable
3. Watch CI to green: `gh pr checks --watch`. If CI fails, diagnose the real cause and fix
   it — don't paper over environment issues.
4. **Hand off to Codex QA** (a separate Codex CLI session runs live QA against these PRs in
   parallel, coordinating only through one shared file — see
   `/Users/mamta/dev/temp/handoff.log`):
   - Append exactly one line: `Codex : <YYYY-MM-DD HH:MM> Test Issue $ARGUMENTS` — note the
     space before the colon (protocol v3). No other detail goes in this file; detailed QA
     findings still land as normal PR comments, not in the log.
   - Then start watching for the reply: launch a polling loop as an actual
     `run_in_background: true` Bash command (never a `nohup`/`disown`-wrapped background
     process — that orphans it and no completion notification ever fires) that checks every
     ~15s for a new line appended after the current line count starting with `Claude :`, and
     exits once it finds one.
   - Do this even if you're not sure a Codex session is currently running — it's a cheap,
     standing part of the handoff and costs nothing if nobody's watching the file yet.
5. Comment on the issue: link the PR, summarize the change in plain language, and give the
   user concrete manual-test steps (what to run, what to click, what they should see).
6. Report back to the user: what you built, what you verified, exact steps for their manual
   test, that the Codex handoff line was written and a watcher is running, and remind them
   to run `/issue_close $ARGUMENTS` when satisfied. **Stop here — do not merge, do not close
   the issue.**
