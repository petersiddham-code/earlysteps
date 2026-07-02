/** Unit tests for the defensive LLM-output parser (issue #26, CLAUDE.md §8 fail-closed). */
import { describe, it, expect } from 'vitest';
import { parseAnalysisOutput } from '../src/analysis/signal-schema.js';

const VALID = {
  signals: [
    {
      red_flag_type: 'loss_of_skills',
      domain: 'communication',
      salience: 'high',
      evidence_quote: 'stopped speaking',
    },
  ],
};

describe('parseAnalysisOutput', () => {
  it('accepts a clean JSON object', () => {
    expect(parseAnalysisOutput(JSON.stringify(VALID))).toHaveLength(1);
  });

  it('tolerates a fenced code block / surrounding prose around the JSON', () => {
    const wrapped = 'Here is the analysis:\n```json\n' + JSON.stringify(VALID) + '\n```';
    expect(parseAnalysisOutput(wrapped)).toHaveLength(1);
  });

  it('accepts an explicitly empty signals array', () => {
    expect(parseAnalysisOutput('{"signals": []}')).toEqual([]);
  });

  it('fails closed on empty text, plain prose, arrays, and broken JSON', () => {
    expect(parseAnalysisOutput('')).toEqual([]);
    expect(parseAnalysisOutput('The child may be showing signs.')).toEqual([]);
    expect(parseAnalysisOutput('[1, 2, 3]')).toEqual([]);
    expect(parseAnalysisOutput('{"signals": [')).toEqual([]);
  });

  it('fails closed on off-enum values and oversized evidence quotes', () => {
    const badType = {
      signals: [{ ...VALID.signals[0], red_flag_type: 'diagnosis' }],
    };
    const hugeQuote = {
      signals: [{ ...VALID.signals[0], evidence_quote: 'x'.repeat(10_000) }],
    };
    expect(parseAnalysisOutput(JSON.stringify(badType))).toEqual([]);
    expect(parseAnalysisOutput(JSON.stringify(hugeQuote))).toEqual([]);
  });

  it('never throws, whatever the input', () => {
    for (const input of ['{{{{', '}', 'null', '"signals"', '{"signals": 3}']) {
      expect(() => parseAnalysisOutput(input)).not.toThrow();
      expect(parseAnalysisOutput(input)).toEqual([]);
    }
  });
});
