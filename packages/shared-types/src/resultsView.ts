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
 */
import type { Domain } from './domains.js';
import type {
  Confidence,
  RecommendationTier,
  SignLevelLabel,
  SupportLevelTerm,
} from './vocabulary.js';
import type { RedFlagType } from './profile.js';

export interface ResultsViewDomain {
  domain: Domain;
  label: SignLevelLabel;
  confidence: Confidence;
}

export interface ResultsViewSupportLevel {
  term: SupportLevelTerm;
  confidence: Confidence;
}

export interface ResultsView {
  disclaimer: string;
  computedAt: string;
  domains: ResultsViewDomain[];
  supportLevel: ResultsViewSupportLevel | null;
  redFlagTypes: RedFlagType[];
  recommendationTier: RecommendationTier;
}
