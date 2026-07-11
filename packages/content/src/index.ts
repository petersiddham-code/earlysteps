/**
 * @earlysteps/content — question banks, scoring weights, and result copy as versioned,
 * validated data (CLAUDE.md §5). Non-engineers edit the JSON; this package validates it.
 */
export * from './schema.js';
export * from './questions.js';
export * from './weights.js';
export * from './questionTotals.js';
export * from './evidenceFloors.js';
export * from './followUps.js';
export * from './resultCopy.js';
export * from './redFlagCopy.js';
export * from './consentCopy.js';
export * from './domainResources.js';
export * from './aiResultsSummaryCopy.js';
export * from './comparisonCopy.js';
export * from './validateContent.js';
