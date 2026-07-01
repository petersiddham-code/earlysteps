import redFlagCopy from '../result-copy/red-flag-copy.json' with { type: 'json' };
import { redFlagCopySchema, type RedFlagCopy } from './schema.js';

export const RED_FLAG_COPY: RedFlagCopy = redFlagCopySchema.parse(redFlagCopy);
