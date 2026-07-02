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

// A reassuring toddler intake — everything points to typical development. Sized to clear
// the minimum-evidence floors (issue #22): >=3 scored answers in each domain present
// (communication 3, social 4, sensory 3) and >=10 scored answers overall.
const reassuring: IntakeResponse[] = [
  r('T1', 'before_12mo'),
  r('T2', 'short_sentences'),
  r('T3', 'yes_often'),
  r('T4', 'looks_right_away'),
  r('T5', 'almost_always'),
  r('T6', 'yes_often'),
  r('T7', 'yes_usually'),
  r('T12', 'no'),
  r('T13', 'no'),
  r('T14', 'wide_variety'),
];

describe('recompute — end-to-end pipeline (uses shipped content weights)', () => {
  it('produces an all-low profile for a reassuring intake', () => {
    const { profile, supportEstimate, redFlags, answeredTotal } = recompute(reassuring, {
      computedAt: AT,
    });
    expect(profile.findings.every((f) => f.level === 'low')).toBe(true);
    expect(supportEstimate?.level).toBe('mild');
    expect(redFlags).toEqual([]);
    expect(profile.computed_at).toBe(AT);
    expect(profile.child_id).toBe('child-1');
    expect(answeredTotal).toBe(reassuring.length);
  });

  it('marks every finding evidence-sufficient for a complete-enough intake (issue #22)', () => {
    const { profile, sufficientEvidenceOverall } = recompute(reassuring, {
      computedAt: AT,
    });
    expect(profile.findings.length).toBeGreaterThan(0);
    for (const f of profile.findings) {
      expect(f.sufficient_evidence).toBe(true);
      expect(f.answered_count).toBeGreaterThanOrEqual(3);
    }
    expect(sufficientEvidenceOverall).toBe(true);
  });

  it('gates a single-answer intake: finding kept for audit but marked insufficient, no estimate (issue #22)', () => {
    const { profile, supportEstimate, sufficientEvidenceOverall, answeredTotal } =
      recompute([r('T4', 'doesnt_notice')], { computedAt: AT });
    const social = profile.findings.find((f) => f.domain === 'social');
    // Level and score stay on the finding (audit/trend history)…
    expect(social?.level).toBe('many');
    // …but the finding is explicitly below the evidence floor: consumers must render
    // "not enough information yet", never the level.
    expect(social?.sufficient_evidence).toBe(false);
    expect(social?.answered_count).toBe(1);
    expect(supportEstimate).toBeNull();
    expect(sufficientEvidenceOverall).toBe(false);
    expect(answeredTotal).toBe(1);
  });

  it('per-domain gate: a thin domain stays insufficient even when the overall floor is met', () => {
    const withThinDomain = [...reassuring, r('T11', 'not_really')];
    const { profile, supportEstimate, sufficientEvidenceOverall } = recompute(
      withThinDomain,
      { computedAt: AT },
    );
    const repetitive = profile.findings.find((f) => f.domain === 'repetitive_behaviour');
    expect(repetitive?.sufficient_evidence).toBe(false);
    expect(sufficientEvidenceOverall).toBe(true);
    expect(supportEstimate).not.toBeNull();
  });

  it('red flags are EXEMPT from the gate: one serious sign fires as the only answer given (CLAUDE.md §2 rule 8)', () => {
    const { redFlags, supportEstimate, sufficientEvidenceOverall } = recompute(
      [r(RF_LOSS_OF_SKILLS_Q, 'yes')],
      { computedAt: AT },
    );
    expect(redFlags.map((f) => f.type)).toContain('loss_of_skills');
    // The gate still withholds the estimate — it only must never hide the flag.
    expect(supportEstimate).toBeNull();
    expect(sufficientEvidenceOverall).toBe(false);
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

  it('scores a re-answered question once, using only the latest answer', () => {
    const stale = { ...r('T4', 'doesnt_notice'), timestamp: '2026-06-01T00:00:00.000Z' };
    const updated = { ...r('T4', 'looks_right_away'), timestamp: AT };
    const { profile } = recompute([stale, updated], { computedAt: AT });
    const social = profile.findings.find((f) => f.domain === 'social');
    // The concerning first answer was superseded — it must not linger in the score.
    expect(social?.level).toBe('low');
    expect(social?.evidence_refs).toEqual([]);
  });

  it('red-flag rules see the latest answer, not a stale superseded one', () => {
    const stale = {
      ...r(RF_LOSS_OF_SKILLS_Q, 'yes'),
      timestamp: '2026-06-01T00:00:00.000Z',
    };
    const updated = { ...r(RF_LOSS_OF_SKILLS_Q, 'no'), timestamp: AT };
    const { redFlags } = recompute([stale, updated], { computedAt: AT });
    expect(redFlags).toEqual([]);
  });

  it('still fires a red flag when the latest re-answer is the concerning one', () => {
    const stale = {
      ...r(RF_LOSS_OF_SKILLS_Q, 'no'),
      timestamp: '2026-06-01T00:00:00.000Z',
    };
    const updated = { ...r(RF_LOSS_OF_SKILLS_Q, 'yes'), timestamp: AT };
    const { redFlags } = recompute([stale, updated], { computedAt: AT });
    expect(redFlags.map((f) => f.type)).toContain('loss_of_skills');
  });

  it('produces no findings and no estimate for an all-"not sure" intake', () => {
    const allUnsure = ['T1', 'T3', 'T4', 'T5', 'T6', 'T7'].map((id) => r(id, 'not_sure'));
    const { profile, supportEstimate } = recompute(allUnsure, { computedAt: AT });
    // No evidence in either direction — must NOT read as reassuring "all low" results.
    expect(profile.findings).toEqual([]);
    expect(supportEstimate).toBeNull();
  });

  // The shipped weights cover every band's questions — one end-to-end case per new bank
  // proves the whole pipeline (bank -> indicator -> domain -> level) is wired for them.
  it('scores primary-band answers through the shipped weights', () => {
    const { profile } = recompute(
      [r('PR4', 'struggles_make_keep'), r('PR13', 'big_reactions')],
      { computedAt: AT },
    );
    const domains = Object.fromEntries(profile.findings.map((f) => [f.domain, f.level]));
    expect(domains).toEqual({ social: 'many', emotional_regulation: 'many' });
  });

  it('scores teen-band answers through the shipped weights', () => {
    const { profile } = recompute([r('TE5', 'very_distressing'), r('TE2', 'yes')], {
      computedAt: AT,
    });
    const domains = Object.fromEntries(profile.findings.map((f) => [f.domain, f.level]));
    expect(domains).toEqual({ repetitive_behaviour: 'many', social: 'low' });
  });

  it('scores young-adult-band answers through the shipped weights', () => {
    const { profile, supportEstimate } = recompute(
      [
        r('YA1', 'comfortable_back_and_forth'),
        r('YA4', 'draining_but_manages'),
        r('YA7', ['loud_sounds', 'busy_places']),
      ],
      { computedAt: AT },
    );
    const domains = Object.fromEntries(profile.findings.map((f) => [f.domain, f.level]));
    expect(domains).toEqual({
      communication: 'low',
      social: 'some',
      sensory: 'some',
    });
    // Only 3 scored answers — below the overall minimum-evidence floor (issue #22), so no
    // estimate. The per-domain levels above prove the YA weights are wired end-to-end.
    expect(supportEstimate).toBeNull();
  });
});
