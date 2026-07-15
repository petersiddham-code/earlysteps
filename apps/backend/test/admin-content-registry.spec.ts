import { describe, it, expect } from 'vitest';
import { ADMIN_EDITABLE_CONTENT_KEYS } from '@earlysteps/shared-types';
import {
  findEditableField,
  isEditableContentKey,
  listEditableFields,
} from '../src/admin/admin-content-registry.js';

describe('admin content registry (issue #127)', () => {
  it('accepts every registered key and rejects anything not registered, including weights/thresholds', () => {
    for (const key of ADMIN_EDITABLE_CONTENT_KEYS) {
      expect(isEditableContentKey(key)).toBe(true);
    }
    expect(isEditableContentKey('weights.domain-weights')).toBe(false);
    expect(isEditableContentKey('thresholds.evidence-floors')).toBe(false);
    expect(isEditableContentKey('made-up-key')).toBe(false);
  });

  it('every registered content key resolves to a non-empty field list with unique paths', () => {
    for (const key of ADMIN_EDITABLE_CONTENT_KEYS) {
      const fields = listEditableFields(key);
      expect(fields.length).toBeGreaterThan(0);
      const paths = fields.map((f) => f.path);
      expect(new Set(paths).size).toBe(paths.length);
      for (const field of fields) {
        expect(typeof field.current_value).toBe('string');
        expect(field.current_value.length).toBeGreaterThan(0);
      }
    }
  });

  it('locks the fixed CLAUDE.md §2 vocabulary and disclaimer in result-copy.labels', () => {
    const paths = listEditableFields('result-copy.labels').map((f) => f.path);
    expect(paths).not.toContain('disclaimer');
    expect(paths).not.toContain('insufficient_evidence.label');
    for (const group of [
      'sign_level_labels',
      'recommendation_tiers',
      'support_level_terms',
    ]) {
      expect(paths.some((p) => p.startsWith(`${group}.`))).toBe(false);
    }
    expect(paths).toContain('card_heading');
  });

  it('locks option ids/kinds and only exposes copy for red-flag-copy', () => {
    const paths = listEditableFields('result-copy.red-flag-copy').map((f) => f.path);
    expect(paths).toContain('base_message');
    expect(paths.some((p) => p.includes('.id]') || p.endsWith('.id'))).toBe(false);
    expect(paths.some((p) => p.endsWith('.kind'))).toBe(false);
  });

  it('locks structural question fields and only exposes text/hint per question', () => {
    const paths = listEditableFields('questions.universal').map((f) => f.path);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.endsWith('.text') || path.endsWith('.hint')).toBe(true);
    }
  });

  it('locks red_flag_type and options on follow-ups, exposing only text/hint', () => {
    const paths = listEditableFields('follow-ups').map((f) => f.path);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.endsWith('.text') || path.endsWith('.hint')).toBe(true);
    }
  });

  it('findEditableField returns undefined for a locked or unknown path', () => {
    expect(findEditableField('result-copy.labels', 'disclaimer')).toBeUndefined();
    expect(findEditableField('result-copy.labels', 'not.a.real.path')).toBeUndefined();
    expect(findEditableField('result-copy.labels', 'card_heading')).toEqual(
      expect.objectContaining({ path: 'card_heading' }),
    );
  });
});
