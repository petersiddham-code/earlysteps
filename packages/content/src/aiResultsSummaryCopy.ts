import copy from '../ai-results-summary/copy.json' with { type: 'json' };
import { aiResultsSummaryCopySchema, type AiResultsSummaryCopy } from './schema.js';

export const AI_RESULTS_SUMMARY_COPY: AiResultsSummaryCopy =
  aiResultsSummaryCopySchema.parse(copy);
