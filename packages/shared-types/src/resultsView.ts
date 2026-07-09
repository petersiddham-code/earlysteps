/**
 * The shape of `apps/backend`'s screening results API response. Lives here (not in the
 * backend app) so `apps/mobile` can consume it without importing across apps. The mapping
 * function that produces this shape (`toResultsView`) stays in the backend — it's server-side
 * business logic; only the wire-format type is shared.
 *
 * This is the ONLY shape the results API is allowed to return — product plan §4.4 ("never a
 * raw numeric score") and CLAUDE.md §2 rule 5 (disclaimer on every result surface) are
 * enforced structurally: DomainFinding.score never appears on ResultsViewDomain, and
 * `disclaimer` is not optional.
 *
 * Minimum-evidence gate (issue #22): a domain below the evidence floor is a DIFFERENT
 * variant of the union with no sign-level label on it at all, so a consumer cannot
 * accidentally render "Low/Some/Many signs observed" from too few answers — the compiler
 * forces the "not enough information yet" state to be handled. Red flags are exempt from
 * the gate (CLAUDE.md §2 rule 8): `redFlagTypes` always carries every triggered flag, and a
 * red flag always forces a non-null recommendationTier.
 */
import type { Domain } from './domains.js';
import type {
  Confidence,
  InsufficientEvidenceLabel,
  RecommendationTier,
  SignLevelLabel,
  SupportLevelTerm,
} from './vocabulary.js';
import type { RedFlagType } from './profile.js';

export type ResultsViewDomain =
  | {
      domain: Domain;
      status: 'scored';
      label: SignLevelLabel;
      confidence: Confidence;
    }
  | {
      domain: Domain;
      status: 'insufficient_evidence';
      label: InsufficientEvidenceLabel;
    };

export interface ResultsViewSupportLevel {
  term: SupportLevelTerm;
  confidence: Confidence;
}

export interface ResultsView {
  disclaimer: string;
  computedAt: string;
  /** Provenance (issue #22): how many answers (latest per question) this view rests on. */
  basedOnAnswers: number;
  domains: ResultsViewDomain[];
  /** Null when no estimate exists OR the overall evidence floor is unmet (fail closed). */
  supportLevel: ResultsViewSupportLevel | null;
  /**
   * True when total answered evidence is below the overall floor: supportLevel is withheld
   * and recommendationTier is null — unless a red flag forces a recommendation (exempt).
   */
  insufficientEvidenceOverall: boolean;
  redFlagTypes: RedFlagType[];
  /**
   * Null only in the "not enough information yet" state with no red flags — even
   * "Support activities can begin now" is a claim too strong for near-zero evidence.
   */
  recommendationTier: RecommendationTier | null;
  /**
   * Confidence for `recommendationTier` (issue #64: a recommendation shown with no
   * confidence label can overstate certainty). Travels 1:1 with `recommendationTier` —
   * null exactly when the tier is null, never present without it and vice versa.
   */
  recommendationConfidence: Confidence | null;
}
