import { parseDay, parsePasted, guessKind, byKind, spendsIn } from './spends';

const TODAY = '2026-10-31';

describe('spends', () => {
  it('reads common date styles and picks the latest past year', () => {
    expect(parseDay('13 Sep', TODAY)).toBe('2026-09-13');
    expect(parseDay('13/09', TODAY)).toBe('2026-09-13');
    expect(parseDay('5 Dec', TODAY)).toBe('2025-12-05');
    expect(parseDay('13-09-2026', TODAY)).toBe('2026-09-13');
    expect(parseDay('2026-09-13', TODAY)).toBe('2026-09-13');
    expect(parseDay('31 Feb', TODAY)).toBeNull();
    expect(parseDay('soon', TODAY)).toBeNull();
  });
  it('turns pasted Excel or WhatsApp rows into spends', () => {
    const rows = parsePasted('13 Sep\t4,200\tGroceries\n13 Sep  6,000  Cooks\n14 Sep 800 Tempo\nhello', TODAY);
    expect(rows.map(r => [r.day, r.amount, r.kind, r.ok])).toEqual([
      ['2026-09-13', 4200, 'Groceries', true],
      ['2026-09-13', 6000, 'Cooks & staff', true],
      ['2026-09-14', 800, 'Transport', true],
      [null, 0, 'Other', false],
    ]);
    expect(guessKind('LPG cylinder')).toBe('Gas');
  });
  it('totals spends by kind within a range', () => {
    const list: any[] = [
      { spent_on: '2026-09-13', amount: 4200, kind: 'Groceries' },
      { spent_on: '2026-09-14', amount: 800, kind: 'Transport' },
      { spent_on: '2026-10-01', amount: 100, kind: 'Tips' },
    ];
    expect(spendsIn(list, { from: '2026-09-01', to: '2026-09-30' })).toHaveLength(2);
    expect(byKind(list)).toEqual([{ kind: 'Groceries', amount: 4200 }, { kind: 'Transport', amount: 800 }, { kind: 'Other', amount: 100 }]);
  });
});
