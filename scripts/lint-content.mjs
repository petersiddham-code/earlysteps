#!/usr/bin/env node
/**
 * Content-safety lint (CLAUDE.md §10 / §11, `pnpm lint:content`).
 *
 * Fails CI if:
 *  1. shipped, caregiver-facing content JSON contains a banned word,
 *  2. result-copy labels drift off the approved list,
 *  3. an LLM prompt template fails to reference the shared guardrail block,
 *  4. a string literal in apps/mobile source contains a banned word, or
 *  5. a results/report screen fails to render <ScreeningDisclaimer /> (CLAUDE.md §2 rule 5).
 *
 * This is a TEXTUAL gate over content JSON + prompt templates + mobile source. Deeper
 * cross-file integrity (weights referencing real questions, exact-match labels) is enforced
 * by validateContent() in the @earlysteps/content test suite; runtime behaviour is covered
 * by the component tests.
 *
 * NOTE: keep BANNED_WORDS in sync with packages/shared-types/src/vocabulary.ts (BANNED_WORDS).
 * This file is plain Node ESM and cannot import the TS source directly.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Mirrors CLAUDE.md §2 rule 4 / product plan §3.2.
const BANNED_WORDS = [
  'defect',
  'abnormal',
  'disorder',
  'broken',
  'wrong',
  'deficient',
  'disease',
  'sick',
  'cure',
  'fix',
];
const bannedPattern = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

/**
 * Explicit, reviewed exceptions: benign phrases that contain a listed word but do not
 * pathologise the child. Each entry is an auditable decision — new occurrences still fail.
 * (The banned-word rule targets words applied TO the child, not "no wrong answer" reassurance.)
 */
const ALLOWLISTED_PHRASES = [
  "there's no wrong answer",
  'no wrong answer',
  // Product plan §4.8's mandated red-flag escalation text, verbatim — a reassuring negation
  // ("nothing is wrong"), not a defect-label applied to the child.
  'seriously wrong',
];

// The only approved caregiver-facing result strings (CLAUDE.md §2 rules 2–3).
const APPROVED_LABELS = new Set([
  'Low signs observed',
  'Some signs observed',
  'Many signs observed',
  'Support activities can begin now',
  'Formal assessment is recommended',
  'Formal assessment strongly recommended soon',
  'mild support needs',
  'moderate support needs',
  'high support needs',
]);

const errors = [];

function walkFiles(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, ext));
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
}

function isAllowlisted(value) {
  const lower = value.toLowerCase();
  return ALLOWLISTED_PHRASES.some((phrase) => lower.includes(phrase));
}

function scanStrings(value, path, file) {
  if (typeof value === 'string') {
    const match = value.match(bannedPattern);
    if (match && !isAllowlisted(value)) {
      errors.push(
        `[banned word "${match[0]}"] ${relative(ROOT, file)} at ${path}: ${JSON.stringify(value)}`,
      );
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => scanStrings(v, `${path}[${i}]`, file));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) scanStrings(v, `${path}.${k}`, file);
  }
}

// 1. Scan caregiver-facing content JSON for banned words.
for (const file of walkFiles(join(ROOT, 'packages', 'content'), '.json')) {
  if (file.includes('node_modules') || file.includes('package.json')) continue;
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`[invalid JSON] ${relative(ROOT, file)}: ${e.message}`);
    continue;
  }
  scanStrings(data, '$', file);
}

// 2. Result-copy labels must be on the approved list — no drift, no paraphrase.
const labelsFile = join(ROOT, 'packages', 'content', 'result-copy', 'labels.json');
try {
  const labels = JSON.parse(readFileSync(labelsFile, 'utf8'));
  for (const group of [
    'sign_level_labels',
    'recommendation_tiers',
    'support_level_terms',
  ]) {
    for (const [key, value] of Object.entries(labels[group] ?? {})) {
      if (!APPROVED_LABELS.has(value)) {
        errors.push(
          `[off-list label] labels.json ${group}.${key}: ${JSON.stringify(value)}`,
        );
      }
    }
  }
} catch (e) {
  errors.push(`[labels.json] ${e.message}`);
}

// 3. Every prompt template must reference the shared guardrail block (CLAUDE.md §2 rule 12).
const promptsDir = join(ROOT, 'src', 'ai', 'prompts');
for (const file of walkFiles(promptsDir, '.md')) {
  if (file.endsWith('_guardrails.md')) continue;
  const text = readFileSync(file, 'utf8');
  if (!text.includes('_guardrails.md')) {
    errors.push(
      `[missing guardrail ref] ${relative(ROOT, file)} does not reference _guardrails.md`,
    );
  }
}

// 4. Banned words in apps/mobile source — screens carry hardcoded caregiver-facing copy in
//    two shapes: quoted string literals AND bare JSX text (<Text>Here's what we noticed</Text>
//    has no quotes). Both are scanned; comments are not (they aren't user-facing, and "fix"
//    is normal engineering vocabulary there). Test files are excluded (they assert against
//    copy). Word boundaries keep identifiers like "prefix"/"fixed" from matching.
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/gs;
// Text between a closing `>` and the next `<`, with no code punctuation inside — the shape
// of a JSX text node (expressions live in `{}`, which splits segments). Heuristic, but a
// false positive can be allowlisted; a false negative here was how a banned word could ship.
const JSX_TEXT = />([^<>{}`]+)</gs;
const mobileSrc = join(ROOT, 'apps', 'mobile', 'src');
const mobileSources = [
  ...walkFiles(mobileSrc, '.ts'),
  ...walkFiles(mobileSrc, '.tsx'),
].filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
for (const file of mobileSources) {
  const source = readFileSync(file, 'utf8');
  const candidates = [
    ...[...source.matchAll(STRING_LITERAL)].map((m) => m[0]),
    ...[...source.matchAll(JSX_TEXT)].map((m) => m[1]),
  ];
  for (const text of candidates) {
    const match = text.match(bannedPattern);
    if (match && !isAllowlisted(text)) {
      errors.push(
        `[banned word "${match[0]}"] ${relative(ROOT, file)}: ${JSON.stringify(text.trim().slice(0, 120))}`,
      );
    }
  }
}

// 5. Every results/report screen must render <ScreeningDisclaimer /> (CLAUDE.md §2 rule 5).
//    Structural source check: a screen file named like a results/report surface must
//    reference the component. The screens directory must yield at least one such file so a
//    rename can't silently reduce this check to a no-op.
const screensDir = join(ROOT, 'apps', 'mobile', 'src', 'screens');
const resultsScreens = walkFiles(screensDir, '.tsx').filter(
  (f) => /results|report/i.test(f) && !f.endsWith('.test.tsx'),
);
if (resultsScreens.length === 0) {
  errors.push(
    '[disclaimer check] no results/report screens found under apps/mobile/src/screens — the disclaimer gate has nothing to verify (was a screen renamed?)',
  );
}
for (const file of resultsScreens) {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('ScreeningDisclaimer')) {
    errors.push(
      `[missing disclaimer] ${relative(ROOT, file)} is a results/report screen but does not render <ScreeningDisclaimer />`,
    );
  }
}

if (errors.length > 0) {
  console.error(`\n✗ content-safety lint failed with ${errors.length} issue(s):\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('');
  process.exit(1);
}

console.log(
  '✓ content-safety lint passed (banned words, off-list labels, guardrail refs).',
);
