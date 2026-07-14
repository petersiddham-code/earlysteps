import { describe, it, expect } from 'vitest';
import { parseSignOffLog } from '../src/admin/admin.service.js';

describe('parseSignOffLog', () => {
  it('parses the sign-off table into structured rows', () => {
    const markdown = `
# Clinical content review

Some prose here.

## Sign-off log

| Date | Content version | What changed | Advisor | Status |
|---|---|---|---|---|
| — | questions 1.0.0 | Initial scaffold. | _pending_ | ⛔ NOT signed off |
| 2026-07-09 | result-copy 1.3.0 | Confidence surfaced. | Peter Siddham | ✅ signed off |

Trailing prose after the table.
`;

    expect(parseSignOffLog(markdown)).toEqual([
      {
        date: '—',
        content_version: 'questions 1.0.0',
        what_changed: 'Initial scaffold.',
        advisor: '_pending_',
        status: '⛔ NOT signed off',
      },
      {
        date: '2026-07-09',
        content_version: 'result-copy 1.3.0',
        what_changed: 'Confidence surfaced.',
        advisor: 'Peter Siddham',
        status: '✅ signed off',
      },
    ]);
  });

  it('returns an empty array when no table is present', () => {
    expect(parseSignOffLog('# No table here\n\nJust prose.')).toEqual([]);
  });
});
