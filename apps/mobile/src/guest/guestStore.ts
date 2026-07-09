import {
  type AgeBand,
  type Child,
  type GenderOption,
  type IntakeResponse,
  type ResultsView,
} from '@earlysteps/shared-types';
import { domainQuestionTotalsForBand } from '@earlysteps/content';
import { recompute, toResultsView } from '@earlysteps/scoring-engine';
import { ApiError } from '../api/client.js';

/**
 * Guest/ephemeral screening (issue #63): declining "Save my answers" must not block the
 * questionnaire, so this mirrors the backend's child + intake + scoring pipeline entirely
 * on-device — the deterministic scoring engine and content bank are pure TypeScript and run
 * identically here (CLAUDE.md §7, same recompute()/toResultsView() the backend uses).
 *
 * Nothing in this module ever reaches the network or on-device storage: it's a plain
 * in-memory Map, gone the moment the app is killed or this module is reloaded — which is
 * the point. A guest child's id is namespaced with GUEST_ID_PREFIX so the api/* wrappers can
 * transparently route calls here instead of to the backend, without every screen needing to
 * know which mode it's in.
 */
const GUEST_ID_PREFIX = 'guest:';

interface GuestChildRecord {
  child: Child;
  responses: IntakeResponse[];
  lastResults: ResultsView | null;
}

const guestChildren = new Map<string, GuestChildRecord>();

export function isGuestChildId(childId: string): boolean {
  return childId.startsWith(GUEST_ID_PREFIX);
}

export interface CreateGuestChildInput {
  family_id: string;
  nickname: string;
  birth_month: number;
  birth_year: number;
  age_band: AgeBand;
  gender?: GenderOption;
  gender_detail?: string;
  languages: string[];
}

function notFound(childId: string): ApiError {
  return new ApiError(404, { message: `No guest child found with id ${childId}` });
}

export function createGuestChild(input: CreateGuestChildInput): Child {
  const child: Child = {
    id: `${GUEST_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
    family_id: input.family_id,
    nickname: input.nickname,
    birth_month: input.birth_month,
    birth_year: input.birth_year,
    age_band: input.age_band,
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.gender_detail ? { gender_detail: input.gender_detail } : {}),
    languages: input.languages,
  };
  guestChildren.set(child.id, { child, responses: [], lastResults: null });
  return child;
}

export function getGuestChild(childId: string): Child {
  const record = guestChildren.get(childId);
  if (!record) throw notFound(childId);
  return record.child;
}

export function getGuestIntakeResponses(childId: string): IntakeResponse[] {
  const record = guestChildren.get(childId);
  if (!record) throw notFound(childId);
  return record.responses;
}

/**
 * Mirrors ScreeningService.submitIntakeResponses minus persistence: merges the new batch
 * into the in-memory history, then recomputes against the FULL history the same way the
 * backend does (recompute() is stateless and has no memory of prior calls), so guest
 * results come from the identical deterministic engine — never a parallel, looser one.
 */
export function submitGuestIntakeResponses(
  childId: string,
  newResponses: IntakeResponse[],
): ResultsView {
  const record = guestChildren.get(childId);
  if (!record) throw notFound(childId);

  record.responses = [...record.responses, ...newResponses];
  const computedAt = new Date().toISOString();
  const { profile, supportEstimate, redFlags, answeredTotal } = recompute(
    record.responses,
    {
      computedAt,
      domainQuestionTotals: domainQuestionTotalsForBand(record.child.age_band),
    },
  );
  const view = toResultsView(profile, supportEstimate, redFlags, answeredTotal);
  record.lastResults = view;
  return view;
}

export function getGuestResults(childId: string): ResultsView {
  const record = guestChildren.get(childId);
  if (!record) throw notFound(childId);
  if (!record.lastResults) {
    throw new ApiError(404, { message: `No computed results yet for child ${childId}` });
  }
  return record.lastResults;
}

/** Forgets a guest child's profile/answers/results — used by "Start a new set of questions",
 * "Delete everything", and session reset, so ephemeral data never outlives its screening. */
export function forgetGuestChild(childId: string): void {
  guestChildren.delete(childId);
}
