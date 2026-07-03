/**
 * Validation tests for the child-creation payload (issue #38). Exercises the DTO exactly
 * as the runtime does — class-transformer's plainToInstance (the ValidationPipe runs with
 * `transform: true`, so @Transform sanitization happens before the validators) followed
 * by class-validator's validate().
 */
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateChildDto } from '../src/families/dto/create-child.dto.js';

const validBody = {
  nickname: 'Alex',
  birth_month: 6,
  birth_year: 2022,
  languages: ['English'],
};

async function validateBody(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateChildDto, body);
  const errors = await validate(dto);
  return { dto, errors };
}

function failedProperties(errors: Awaited<ReturnType<typeof validate>>) {
  return errors.map((e) => e.property);
}

describe('CreateChildDto — nickname (issue #38)', () => {
  it('accepts a plain valid payload', async () => {
    const { errors } = await validateBody(validBody);
    expect(errors).toEqual([]);
  });

  it('rejects a whitespace-only nickname (trimmed before IsNotEmpty)', async () => {
    const { errors } = await validateBody({ ...validBody, nickname: '   ' });
    expect(failedProperties(errors)).toContain('nickname');
  });

  it('strips BiDi control characters instead of storing a spoofable name', async () => {
    const { dto, errors } = await validateBody({
      ...validBody,
      nickname: '‮Admin', // Right-to-Left Override + "Admin" — renders as "nimdA"
    });
    expect(errors).toEqual([]);
    expect(dto.nickname).toBe('Admin');
  });

  it('strips every BiDi control (embeddings, marks, isolates), keeping the visible name', async () => {
    const { dto, errors } = await validateBody({
      ...validBody,
      nickname: '‪‎mira⁩‏',
    });
    expect(errors).toEqual([]);
    expect(dto.nickname).toBe('mira');
  });

  it('keeps ZWJ/ZWNJ — load-bearing in Persian/Devanagari names, not a BiDi control', async () => {
    const { dto, errors } = await validateBody({ ...validBody, nickname: 'می‌خواهم' });
    expect(errors).toEqual([]);
    expect(dto.nickname).toContain('‌');
  });

  it('accepts names in non-Latin scripts with combining marks (no allowlist regex)', async () => {
    for (const nickname of ['मीरा', 'أحمد', "O'Brien-Núñez", '小明']) {
      const { errors } = await validateBody({ ...validBody, nickname });
      expect(errors, `nickname ${nickname} should be valid`).toEqual([]);
    }
  });

  it('rejects a 10,000-character nickname (max 100)', async () => {
    const { errors } = await validateBody({ ...validBody, nickname: 'A'.repeat(10000) });
    expect(failedProperties(errors)).toContain('nickname');
  });

  it('accepts exactly 100 characters and rejects 101 (boundary)', async () => {
    expect(
      (await validateBody({ ...validBody, nickname: 'A'.repeat(100) })).errors,
    ).toEqual([]);
    expect(
      failedProperties(
        (await validateBody({ ...validBody, nickname: 'A'.repeat(101) })).errors,
      ),
    ).toContain('nickname');
  });

  it('trims surrounding whitespace so the stored name is the visible name', async () => {
    const { dto, errors } = await validateBody({ ...validBody, nickname: '  Sam  ' });
    expect(errors).toEqual([]);
    expect(dto.nickname).toBe('Sam');
  });
});

describe('CreateChildDto — languages and gender_detail get the same hardening', () => {
  it('rejects a whitespace-only language entry', async () => {
    const { errors } = await validateBody({ ...validBody, languages: ['   '] });
    expect(failedProperties(errors)).toContain('languages');
  });

  it('rejects an oversized language entry (max 100 each)', async () => {
    const { errors } = await validateBody({
      ...validBody,
      languages: ['A'.repeat(101)],
    });
    expect(failedProperties(errors)).toContain('languages');
  });

  it('strips BiDi controls from typed languages ("Other — type it" flows here, #28)', async () => {
    const { dto, errors } = await validateBody({
      ...validBody,
      languages: ['‮Portuguese '],
    });
    expect(errors).toEqual([]);
    expect(dto.languages).toEqual(['Portuguese']);
  });

  it('rejects an oversized gender_detail (max 200)', async () => {
    const { errors } = await validateBody({
      ...validBody,
      gender: 'self_describe',
      gender_detail: 'A'.repeat(201),
    });
    expect(failedProperties(errors)).toContain('gender_detail');
  });
});
