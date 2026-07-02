import { describe, it, expect } from 'vitest';
import type { IntakeResponse } from '@earlysteps/shared-types';
import type { Indicator } from '@earlysteps/content';
import { scoreDomains, type DomainScore } from './scoreDomain.js';

const indicators: Record<string, Indicator> = {
  Q1: {
    question_id: 'Q1',
    domain: 'social',
    combine: 'max',
    option_weights: { bad: 10, mid: 5 },
  },
  Q2: {
    question_id: 'Q2',
    domain: 'social',
    combine: 'max',
    option_weights: { bad: 10 },
  },
  Q3: {
    question_id: 'Q3',
    domain: 'sensory',
    combine: 'sum',
    option_weights: { a: 5, b: 5, c: 5, d: 5 },
  },
};

function resp(question_id: string, answer: IntakeResponse['answer']): IntakeResponse {
  return { child_id: 'c1', question_id, domain: 'social', answer, timestamp: 't' };
}

/** Returns the single expected domain score, asserting exactly one was produced. */
function scoreDomainsFirst(
  responses: IntakeResponse[],
  inds: Record<string, Indicator>,
): DomainScore {
  const scores = scoreDomains(responses, inds);
  expect(scores).toHaveLength(1);
  return scores[0]!;
}

describe('scoreDomains — deterministic normalization', () => {
  it('ignores namespaced free-text entries in answer arrays (weight 0, order-safe)', () => {
    // A caregiver note rides in the same array as option ids, prefixed free_text: —
    // it must add nothing to the numerator and never displace the option id.
    const social = scoreDomainsFirst(
      [
        resp('Q1', ['bad', 'free_text:my son does not like kids crying']),
        resp('Q2', 'bad'),
      ],
      indicators,
    );
    expect(social.score).toBe(100);
    expect(social.answeredCount).toBe(2);
  });

  it('scores a fully concerning domain at 100 (many)', () => {
    const social = scoreDomainsFirst([resp('Q1', 'bad'), resp('Q2', 'bad')], indicators);
    expect(social.score).toBe(100);
    expect(social.level).toBe('many');
    expect(social.answeredCount).toBe(2);
  });

  it('lets a reassuring answer pull the score down (adds to denominator only)', () => {
    // Q1 answered with an unweighted/reassuring option → contribution 0, max still 10.
    const social = scoreDomainsFirst([resp('Q1', 'good'), resp('Q2', 'bad')], indicators);
    expect(social.score).toBe(50); // 10 / 20
    expect(social.level).toBe('some');
  });

  it('scores an all-reassuring domain at 0 (low)', () => {
    const social = scoreDomainsFirst(
      [resp('Q1', 'good'), resp('Q2', 'good')],
      indicators,
    );
    expect(social.score).toBe(0);
    expect(social.level).toBe('low');
    expect(social.evidence_refs).toEqual([]);
  });

  it('sums selected chips for multi-select and normalizes against total chip weight', () => {
    const sensory = scoreDomainsFirst([resp('Q3', ['a', 'b'])], indicators);
    expect(sensory.score).toBe(50); // 10 / 20 → 'some'
    expect(sensory.level).toBe('some');
  });

  it('records evidence only for contributing answers', () => {
    const social = scoreDomainsFirst([resp('Q1', 'mid'), resp('Q2', 'bad')], indicators);
    expect(social.score).toBe(75); // 15 / 20 → many
    expect(social.level).toBe('many');
    expect(social.evidence_refs.map((e) => e.ref_id).sort()).toEqual(['Q1', 'Q2']);
  });

  it('ignores answers with no matching indicator', () => {
    const scores = scoreDomains([resp('UNKNOWN', 'x')], indicators);
    expect(scores).toEqual([]);
  });
});

describe('scoreDomains — uncertainty answers are a gap, not evidence', () => {
  it('treats a "not_sure" single-select as unanswered (no denominator, no count)', () => {
    // Without the exclusion this would be 10/20 = 50; "not sure" must not act reassuring.
    const social = scoreDomainsFirst(
      [resp('Q1', 'not_sure'), resp('Q2', 'bad')],
      indicators,
    );
    expect(social.score).toBe(100); // 10 / 10 — Q1 contributes nothing either way
    expect(social.answeredCount).toBe(1); // must not inflate confidence completeness
  });

  it('treats "prefer_not_to_say" the same way', () => {
    const scores = scoreDomains([resp('Q1', 'prefer_not_to_say')], indicators);
    expect(scores).toEqual([]);
  });

  it('produces no domain score at all for an all-uncertain intake', () => {
    const scores = scoreDomains(
      [resp('Q1', 'not_sure'), resp('Q2', 'not_sure')],
      indicators,
    );
    expect(scores).toEqual([]);
  });

  it('filters uncertainty ids out of a multi-select but keeps real selections', () => {
    const sensory = scoreDomainsFirst([resp('Q3', ['a', 'not_sure'])], indicators);
    expect(sensory.score).toBe(25); // 5 / 20 — only the real selection counts
  });

  it('skips a multi-select whose only selection is an uncertainty id', () => {
    const scores = scoreDomains([resp('Q3', ['not_sure'])], indicators);
    expect(scores).toEqual([]);
  });
});
