---
description: "After the user's manual test passes: merge the issue's PR, confirm the merged state is green, and close out the GitHub issue"
argument-hint: <issue-number>
---

# /issue_close — merge and close a tested issue

The user has manually tested the work for GitHub issue **#$ARGUMENTS** (built via `/issue`)
and is satisfied. Your job: merge its PR safely, prove the merged state is still green, and
close the loop on the issue. The user invoking this command IS the testing sign-off — do
not re-ask "are you sure"; do the checks below instead, and stop only if one fails.

## 1. Locate and validate the PR — every check must pass before merging

1. If `$ARGUMENTS` is not a single issue number, ask for one and stop.
2. `gh issue view $ARGUMENTS` — confirm the issue exists and is open. If it's already
   closed, say so and stop.
3. Find the open PR for this issue: `gh pr list --state open --search "$ARGUMENTS in:body"`
   (the `/issue` convention puts `Closes #$ARGUMENTS` in the body; branch naming is
   `issue/$ARGUMENTS-*`). Exactly one open PR must match — if none or several, report what
   you found and stop for the user to disambiguate.
4. Validate the PR, and STOP with a clear report if any of these fail:
   - **CI is green**: `gh pr checks <pr>` — all passing. Never merge red or pending CI.
   - **Mergeable**: no conflicts with `master`. If conflicted, resolve locally on the
     branch (never through GitHub's auto-merge UI), re-run the full gate on the resolved
     result, push, wait for CI green — then continue.
   - **Clinical-content gate (CLAUDE.md §9)**: if the PR is flagged "clinical content
     change — needs advisor sign-off", check the sign-off log in
     `docs/clinical-review/README.md`. If the row for this change still says pending,
     surface that explicitly: merging to `master` keeps the established
     pending-sign-off precedent, but the user must say so knowingly — ask before merging,
     and never let it into a release/pilot branch without the recorded sign-off.
   - **Branch is current**: if `master` moved since the PR branched and the changes could
     interact (same files/subsystem), rebase or merge master into the branch, re-run the
     gate, and let CI go green again before merging.

## 2. Merge and verify the merged state

1. `gh pr merge <pr> --squash --delete-branch`
2. Sync local: `git checkout master && git pull && git remote prune origin`
3. **Re-run the full gate on merged master** — don't trust the PR's own CI run in
   isolation: `pnpm typecheck && pnpm lint && pnpm lint:content && pnpm test && pnpm test:mobile`
4. If the merged change has a runtime surface, do a quick live smoke of the affected flow
   (curl for backend, browser for UI) on merged master. If anything is broken, fix forward
   immediately or revert the merge — never leave master red — and report what happened.

## 3. Close out the issue

1. The `Closes #$ARGUMENTS` reference auto-closes the issue on merge — verify with
   `gh issue view $ARGUMENTS` that its state is now CLOSED. If the PR body lacked the
   reference, close it explicitly: `gh issue close $ARGUMENTS`.
2. Add a closing comment on the issue with: the merged PR number and squash commit SHA,
   a one-paragraph summary of what shipped, what was verified after the merge (gate + any
   live smoke), and — if the work was clinical content — a reminder that advisor sign-off
   is still pending in `docs/clinical-review/` (if it is).
3. Report back to the user: merged PR, commit on master, post-merge verification results,
   issue closed, and anything follow-up-worthy that came out of the work (documented gaps,
   deferred pieces, pending sign-offs).
