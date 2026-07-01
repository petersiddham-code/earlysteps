import weights from '../weights/domain-weights.json';
import { weightsTableSchema, type WeightsTable, type Indicator } from './schema.js';

/** The validated weights table. Placeholder values — see needs_clinical_signoff. */
export const WEIGHTS: WeightsTable = weightsTableSchema.parse(weights);

/** Indicators keyed by question_id for O(1) lookup during scoring. */
export const INDICATORS_BY_QUESTION: Record<string, Indicator> = Object.fromEntries(
  WEIGHTS.indicators.map((ind) => [ind.question_id, ind]),
);
