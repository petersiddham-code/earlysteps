import copy from '../comparison/copy.json' with { type: 'json' };
import { comparisonCopySchema, type ComparisonCopy } from './schema.js';

export const COMPARISON_COPY: ComparisonCopy = comparisonCopySchema.parse(copy);
