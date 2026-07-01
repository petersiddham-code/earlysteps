/**
 * Developmental domains and age bands.
 *
 * Domains mirror the DomainProfile in product plan §7. They are used *descriptively* to
 * structure a strengths-and-support picture — never as diagnostic criteria (CLAUDE.md §2,
 * product plan §3.1).
 */

export const DOMAINS = [
  'communication',
  'social',
  'repetitive_behaviour',
  'sensory',
  'learning',
  'attention',
  'motor',
  'emotional_regulation',
  'daily_living',
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Human-facing, respectful domain names (product plan §3.2). */
export const DOMAIN_DISPLAY_NAMES: Record<Domain, string> = {
  communication: 'communication differences',
  social: 'social interaction style',
  repetitive_behaviour: 'repetitive/self-regulating behaviours',
  sensory: 'sensory needs',
  learning: 'learning style',
  attention: 'attention profile',
  motor: 'motor skill development',
  emotional_regulation: 'emotional regulation',
  daily_living: 'daily living skills',
};

/**
 * Age bands the question banks and activities are organised by (product plan §4.1c).
 * MVP ships toddler + preschool only; primary + teen are defined here but deferred.
 */
export const AGE_BANDS = ['toddler', 'preschool', 'primary', 'teen'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Age bands MVP actually ships (product plan §11). */
export const MVP_AGE_BANDS = [
  'toddler',
  'preschool',
] as const satisfies readonly AgeBand[];

/** A question may apply to a specific band or be asked once for everyone. */
export type QuestionAgeBand = AgeBand | 'universal';
