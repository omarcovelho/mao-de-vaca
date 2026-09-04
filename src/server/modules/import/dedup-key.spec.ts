import {
  assignOccurrences,
  buildDedupKey,
  fingerprintBase,
} from './dedup-key';

describe('buildDedupKey', () => {
  const origin = 'acc-1';
  const date = '2026-01-06';
  const amount = '-12.00';
  const description = 'NuTag*RHG9B72';

  it('occurrence 1 matches legacy key without occurrence suffix', () => {
    const legacy = buildDedupKey(origin, date, amount, description);
    const withOne = buildDedupKey(origin, date, amount, description, 1);
    expect(withOne).toBe(legacy);
  });

  it('occurrence 2 differs from occurrence 1', () => {
    const first = buildDedupKey(origin, date, amount, description, 1);
    const second = buildDedupKey(origin, date, amount, description, 2);
    expect(second).not.toBe(first);
  });

  it('normalizes description whitespace and case', () => {
    const a = buildDedupKey(origin, date, amount, '  Foo   Bar  ', 1);
    const b = buildDedupKey(origin, date, amount, 'foo bar', 1);
    expect(a).toBe(b);
  });
});

describe('assignOccurrences', () => {
  it('assigns 1,2 for identical fingerprints in file order', () => {
    const origin = 'card-1';
    const rows = [
      {
        competenceDate: '2026-01-06',
        amount: '-12.00',
        description: 'NuTag*RHG9B72',
      },
      {
        competenceDate: '2026-01-06',
        amount: '-5.40',
        description: 'NuTag*RHG9B72',
      },
      {
        competenceDate: '2026-01-06',
        amount: '-12.00',
        description: 'NuTag*RHG9B72',
      },
    ];
    expect(assignOccurrences(rows, origin)).toEqual([1, 1, 2]);
  });
});

describe('fingerprintBase', () => {
  it('is stable for normalized description', () => {
    const origin = 'acc-1';
    expect(
      fingerprintBase(origin, '2026-01-01', '-1.00', '  A  B '),
    ).toBe(fingerprintBase(origin, '2026-01-01', '-1.00', 'a b'));
  });
});
