/**
 * Dedupe intake responses so only the caregiver's CURRENT answer per question counts.
 *
 * Closes docs/clinical-review/content-gaps.md item 7: recompute() always runs against a
 * child's full answer history, so a re-answered question would otherwise contribute twice —
 * inflating the domain denominator and, worse, letting red-flag rules read a stale first
 * answer (`find()` returns the earliest match). Keeping only the latest answer per
 * question_id fixes both consumers at the single entry point.
 */
import type { IntakeResponse } from '@earlysteps/shared-types';

/**
 * Returns at most one response per question_id — the one with the latest timestamp.
 * Ties (or unparseable timestamps) resolve to the response appearing later in the array,
 * which matches persistence order (rows are appended, so "later" means "more recent").
 * Original relative order of the surviving responses is preserved.
 */
export function dedupeLatestByQuestion(responses: IntakeResponse[]): IntakeResponse[] {
  const latest = new Map<string, IntakeResponse>();
  for (const response of responses) {
    const prev = latest.get(response.question_id);
    if (!prev || !isStrictlyNewer(prev.timestamp, response.timestamp)) {
      latest.set(response.question_id, response);
    }
  }
  if (latest.size === responses.length) return responses;
  const survivors = new Set(latest.values());
  return responses.filter((r) => survivors.has(r));
}

/** True only when `a` parses to a strictly later instant than `b`. */
function isStrictlyNewer(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isFinite(ta) && Number.isFinite(tb) && ta > tb;
}
