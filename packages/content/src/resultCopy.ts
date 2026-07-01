import labels from '../result-copy/labels.json';
import { resultCopySchema, type ResultCopy } from './schema.js';

export const RESULT_COPY: ResultCopy = resultCopySchema.parse(labels);
