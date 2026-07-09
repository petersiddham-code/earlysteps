/**
 * `toResultsView` now lives in @earlysteps/scoring-engine (issue #63) so mobile's guest/
 * ephemeral pipeline can shape a locally-recomputed profile into the exact same wire shape
 * as a persisted one, on-device, with zero duplicated logic. Re-exported here so every
 * existing backend import path (`./results-view.js`) keeps working unchanged.
 */
export { toResultsView } from '@earlysteps/scoring-engine';
export type {
  ResultsView,
  ResultsViewDomain,
  ResultsViewSupportLevel,
} from '@earlysteps/shared-types';
