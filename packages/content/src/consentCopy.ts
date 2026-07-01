import copy from '../consent/copy.json' with { type: 'json' };
import { consentCopySchema, type ConsentCopy } from './schema.js';

export const CONSENT_COPY: ConsentCopy = consentCopySchema.parse(copy);
