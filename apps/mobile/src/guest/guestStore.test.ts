import { ApiError } from '../api/client.js';
import {
  createGuestChild,
  forgetGuestChild,
  getGuestChild,
  getGuestIntakeResponses,
  getGuestResults,
  isGuestChildId,
  submitGuestIntakeResponses,
} from './guestStore.js';

const CHILD_INPUT = {
  family_id: 'f1',
  nickname: 'Alex',
  birth_month: 6,
  birth_year: 2024,
  age_band: 'toddler' as const,
  languages: ['English'],
};

describe('guestStore (issue #63)', () => {
  it('isGuestChildId recognizes only guest-namespaced ids', () => {
    const child = createGuestChild(CHILD_INPUT);
    expect(isGuestChildId(child.id)).toBe(true);
    expect(isGuestChildId('c1')).toBe(false);
  });

  it('createGuestChild builds a Child shape without ever calling the backend, each with a unique id', () => {
    const a = createGuestChild(CHILD_INPUT);
    const b = createGuestChild(CHILD_INPUT);

    expect(a.id).not.toEqual(b.id);
    expect(a).toMatchObject({
      family_id: 'f1',
      nickname: 'Alex',
      birth_month: 6,
      birth_year: 2024,
      age_band: 'toddler',
      languages: ['English'],
    });
  });

  it('omits gender fields entirely when not provided, same as the connected createChild payload', () => {
    const child = createGuestChild(CHILD_INPUT);
    expect(child).not.toHaveProperty('gender');
    expect(child).not.toHaveProperty('gender_detail');
  });

  it('getGuestChild throws a 404-shaped ApiError for an unknown id, matching the backend 404 contract', () => {
    expect(() => getGuestChild('guest:missing')).toThrow(ApiError);
    try {
      getGuestChild('guest:missing');
    } catch (err) {
      expect((err as ApiError).status).toBe(404);
    }
  });

  it('getGuestResults throws a 404-shaped ApiError before any answers are submitted', () => {
    const child = createGuestChild(CHILD_INPUT);
    expect(() => getGuestResults(child.id)).toThrow(ApiError);
  });

  it('submitGuestIntakeResponses recomputes via the real scoring engine and getGuestResults returns the same view', () => {
    const child = createGuestChild(CHILD_INPUT);
    const view = submitGuestIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T1',
        domain: 'communication',
        answer: 'before_12mo',
        timestamp: '2026-07-09T00:00:00.000Z',
      },
    ]);

    expect(view.disclaimer).toBeTruthy();
    expect(view.basedOnAnswers).toBe(1);
    expect(getGuestResults(child.id)).toEqual(view);
  });

  it('accumulates answers across multiple submissions, same as the backend history model', () => {
    const child = createGuestChild(CHILD_INPUT);
    submitGuestIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T1',
        domain: 'communication',
        answer: 'before_12mo',
        timestamp: '2026-07-09T00:00:00.000Z',
      },
    ]);
    const second = submitGuestIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'social',
        answer: 'yes',
        timestamp: '2026-07-09T00:01:00.000Z',
      },
    ]);

    expect(second.basedOnAnswers).toBe(2);
    expect(getGuestIntakeResponses(child.id)).toHaveLength(2);
  });

  it('forgetGuestChild drops the child so it 404s afterwards — nothing outlives its screening', () => {
    const child = createGuestChild(CHILD_INPUT);
    submitGuestIntakeResponses(child.id, []);
    forgetGuestChild(child.id);

    expect(() => getGuestChild(child.id)).toThrow(ApiError);
    expect(() => getGuestIntakeResponses(child.id)).toThrow(ApiError);
  });
});
