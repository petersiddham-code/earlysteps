import { describe, it, expect } from 'vitest';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { dedupeLatestByQuestion } from './dedupe.js';

function r(
  question_id: string,
  answer: IntakeResponse['answer'],
  timestamp: string,
): IntakeResponse {
  return { child_id: 'c1', question_id, domain: 'communication', answer, timestamp };
}

describe('dedupeLatestByQuestion — only the current answer per question counts', () => {
  it('returns the input unchanged when there are no repeats', () => {
    const responses = [
      r('T1', 'not_yet', '2026-07-01T00:00:00.000Z'),
      r('T2', 'none_yet', '2026-07-01T00:00:01.000Z'),
    ];
    expect(dedupeLatestByQuestion(responses)).toBe(responses);
  });

  it('keeps only the latest answer when a question was re-answered', () => {
    const first = r('T1', 'not_yet', '2026-07-01T00:00:00.000Z');
    const updated = r('T1', 'before_12mo', '2026-07-02T00:00:00.000Z');
    expect(dedupeLatestByQuestion([first, updated])).toEqual([updated]);
  });

  it('keeps the latest answer even when it appears earlier in the array', () => {
    const updated = r('T1', 'before_12mo', '2026-07-02T00:00:00.000Z');
    const stale = r('T1', 'not_yet', '2026-07-01T00:00:00.000Z');
    expect(dedupeLatestByQuestion([updated, stale])).toEqual([updated]);
  });

  it('resolves timestamp ties to the later array position (persistence order)', () => {
    const at = '2026-07-01T00:00:00.000Z';
    const first = r('T1', 'not_yet', at);
    const second = r('T1', 'before_12mo', at);
    expect(dedupeLatestByQuestion([first, second])).toEqual([second]);
  });

  it('dedupes per question independently and preserves relative order', () => {
    const t1Stale = r('T1', 'not_yet', '2026-07-01T00:00:00.000Z');
    const t2 = r('T2', 'none_yet', '2026-07-01T00:00:01.000Z');
    const t1Fresh = r('T1', 'before_12mo', '2026-07-02T00:00:00.000Z');
    expect(dedupeLatestByQuestion([t1Stale, t2, t1Fresh])).toEqual([t2, t1Fresh]);
  });

  it('handles an empty input', () => {
    expect(dedupeLatestByQuestion([])).toEqual([]);
  });
});
