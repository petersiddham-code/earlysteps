/**
 * Issue #127: registry of which packages/content fields the Admin Console may draft an
 * edit for, and a generic walker that lists them with their current live values.
 *
 * This is the actual safety boundary for content editing, not the UI — `createDraft()` in
 * admin.service.ts re-derives this same field list server-side and rejects any path that
 * isn't in it, so a client can never draft an edit to a field this file doesn't expose.
 * Deliberately excludes: scoring weights (weights/domain-weights.json) and evidence-floor
 * thresholds (thresholds/evidence-floors.json) — CLAUDE.md §7 singles these out as needing
 * explicit clinical-review sign-off before ANY change, numeric or not, so they stay
 * code+PR-only rather than becoming admin-draftable in this phase. See
 * docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md for the full
 * risk-tier writeup.
 */
import {
  AI_RESULTS_SUMMARY_COPY,
  COMPARISON_COPY,
  CONSENT_COPY,
  DOMAIN_RESOURCES,
  FOLLOW_UPS,
  QUESTION_BANKS,
  RED_FLAG_COPY,
  RESULT_COPY,
} from '@earlysteps/content';
import {
  ADMIN_EDITABLE_CONTENT_KEYS,
  type AdminEditableContentKey,
  type AdminEditableField,
} from '@earlysteps/shared-types';

/**
 * Field NAMES that are structural, id-like, or fixed vocabulary — never draftable, and the
 * whole subtree under them is skipped so e.g. an option's own `id` can never be reached.
 * CLAUDE.md §2 rules 2/3/5 fix `disclaimer` / sign_level_labels / recommendation_tiers /
 * support_level_terms verbatim; §7/§8 mean option ids, red_flag_type, age_band, domain,
 * kind, type, collected_at, and follow_up wiring are load-bearing for scoring and red-flag
 * rules and must stay code+PR-only.
 */
const LOCKED_FIELD_NAMES = new Set([
  'id',
  'version',
  'locale',
  'needs_clinical_signoff',
  'note',
  'disclaimer',
  'domain',
  'kind',
  'red_flag_type',
  'age_band',
  'type',
  'collected_at',
  'follow_up',
  'options',
  'sign_level_labels',
  'recommendation_tiers',
  'support_level_terms',
]);

/**
 * Exact-path locks for fields whose NAME is legitimately editable elsewhere in the same
 * file but whose value at this specific path is separately fixed. `insufficient_evidence.
 * label` is the shipped "Not enough information yet" state string — checked against
 * INSUFFICIENT_EVIDENCE_LABEL by validateContent() and against the lint script's
 * APPROVED_LABELS set, so drafting a different value here would only ever be rejected
 * downstream; better to never offer it.
 */
const LOCKED_PATHS = new Set(['insufficient_evidence.label']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function labelFor(path: string): string {
  return path
    .replace(/\[/g, ' → ')
    .replace(/\]/g, '')
    .replace(/\./g, ' → ')
    .replace(/_/g, ' ');
}

function walk(value: unknown, path: string, fields: AdminEditableField[]): void {
  if (typeof value === 'string') {
    if (!LOCKED_PATHS.has(path)) {
      fields.push({ path, label: labelFor(path), current_value: value });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemId =
        isRecord(item) && typeof item.id === 'string' ? item.id : String(index);
      walk(item, `${path}[${itemId}]`, fields);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (LOCKED_FIELD_NAMES.has(key)) continue;
      walk(child, path ? `${path}.${key}` : key, fields);
    }
  }
}

function contentRoot(contentKey: AdminEditableContentKey): unknown {
  if (contentKey.startsWith('questions.')) {
    return QUESTION_BANKS[contentKey.slice('questions.'.length)];
  }
  switch (contentKey) {
    case 'result-copy.labels':
      return RESULT_COPY;
    case 'result-copy.red-flag-copy':
      return RED_FLAG_COPY;
    case 'domain-resources':
      return DOMAIN_RESOURCES;
    case 'follow-ups':
      return FOLLOW_UPS;
    case 'consent.copy':
      return CONSENT_COPY;
    case 'ai-results-summary.copy':
      return AI_RESULTS_SUMMARY_COPY;
    case 'comparison.copy':
      return COMPARISON_COPY;
    default:
      return undefined;
  }
}

export function isEditableContentKey(key: string): key is AdminEditableContentKey {
  return (ADMIN_EDITABLE_CONTENT_KEYS as readonly string[]).includes(key);
}

/** The current, live, draftable fields for one content key — recomputed on every call. */
export function listEditableFields(
  contentKey: AdminEditableContentKey,
): AdminEditableField[] {
  const root = contentRoot(contentKey);
  const fields: AdminEditableField[] = [];
  walk(root, '', fields);
  return fields;
}

/** A single field's live value, or undefined if `path` isn't currently draftable. */
export function findEditableField(
  contentKey: AdminEditableContentKey,
  path: string,
): AdminEditableField | undefined {
  return listEditableFields(contentKey).find((field) => field.path === path);
}
