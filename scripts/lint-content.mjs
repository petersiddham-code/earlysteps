#!/usr/bin/env node
/**
 * Content-safety lint (CLAUDE.md §10 / §11, `pnpm lint:content`).
 *
 * Fails CI if shipped, caregiver-facing content contains a banned word or an off-list result
 * label, and if any LLM prompt template fails to reference the shared guardrail block.
 *
 * This is a TEXTUAL gate over content JSON + prompt templates. Deeper cross-file integrity
 * (weights referencing real questions, exact-match labels) is enforced by validateContent()
 * in the @earlysteps/content test suite. The "disclaimer present on every results/report
 * route" half of this check (CLAUDE.md §10) is stubbed below until the mobile app exists.
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
const ALLOWLISTED_PHRASES = ["there's no wrong answer", 'no wrong answer'];

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

// TODO (post-mobile): assert <ScreeningDisclaimer /> renders on every results/report route.

if (errors.length > 0) {
  console.error(`\n✗ content-safety lint failed with ${errors.length} issue(s):\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('');
  process.exit(1);
}

console.log(
  '✓ content-safety lint passed (banned words, off-list labels, guardrail refs).',
);
