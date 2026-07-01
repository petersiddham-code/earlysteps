import { describe, it, expect } from 'vitest';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { recompute } from './recompute.js';
import { RF_LOSS_OF_SKILLS_Q } from './redFlags.js';

const AT = '2026-07-01T00:00:00.000Z';

function r(question_id: string, answer: IntakeResponse['answer']): IntakeResponse {
  return {
    child_id: 'child-1',
    question_id,
    domain: 'communication',
    answer,
    timestamp: AT,
  };
}

// A reassuring toddler intake — everything points to typical development.
const reassuring: IntakeResponse[] = [
  r('T1', 'before_12mo'),
  r('T2', 'short_sentences'),
  r('T3', 'yes_often'),
  r('T4', 'looks_right_away'),
  r('T5', 'almost_always'),
  r('T6', 'yes_often'),
  r('T7', 'yes_usually'),
];

describe('recompute — end-to-end pipeline (uses shipped content weights)', () => {
  it('produces an all-low profile for a reassuring intake', () => {
    const { profile, supportEstimate, redFlags } = recompute(reassuring, {
      computedAt: AT,
    });
    expect(profile.findings.every((f) => f.level === 'low')).toBe(true);
    expect(supportEstimate?.level).toBe('mild');
    expect(redFlags).toEqual([]);
    expect(profile.computed_at).toBe(AT);
    expect(profile.child_id).toBe('child-1');
  });

  it('raises a red flag INDEPENDENTLY of a low domain score (§8.5 — never averaged away)', () => {
    // Same reassuring answers, plus one serious regression signal.
    const withRegression = [...reassuring, r(RF_LOSS_OF_SKILLS_Q, 'yes')];
    const { profile, redFlags } = recompute(withRegression, { computedAt: AT });

    // Domain profile is still low — the single serious sign does NOT get diluted into it...
    expect(profile.findings.every((f) => f.level === 'low')).toBe(true);
    // ...yet the red flag fires regardless of the low aggregate score.
    expect(redFlags.map((f) => f.type)).toContain('loss_of_skills');
    expect(redFlags[0]?.evidence_refs[0]?.ref_id).toBe(RF_LOSS_OF_SKILLS_Q);
  });

  it('surfaces both a raised social score and a name-response flag for a concerning answer', () => {
    const concerning: IntakeResponse[] = [
      r('T4', 'doesnt_notice'),
      r('T5', 'rarely'),
      r('T6', 'not_noticed'),
    ];
    const { profile, redFlags } = recompute(concerning, { computedAt: AT });
    const social = profile.findings.find((f) => f.domain === 'social');
    expect(social?.level).toBe('many');
    expect(redFlags.map((f) => f.type)).toContain('no_name_response');
  });

  it('does not mutate across calls — fresh objects each time (history retained)', () => {
    const a = recompute(reassuring, { computedAt: AT });
    const b = recompute(reassuring, { computedAt: AT });
    expect(a.profile).not.toBe(b.profile);
    expect(a.profile).toEqual(b.profile);
  });

  it('caps confidence at low for a sparse intake', () => {
    const { profile } = recompute([r('T4', 'doesnt_notice')], { computedAt: AT });
    const social = profile.findings.find((f) => f.domain === 'social');
    expect(social?.confidence).toBe('low');
  });
});
