import { GROUPS, SETTING_ROWS, groupNotes, searchSettings, gstLabel, isOldSlab, StatusInput } from './settingsIndex';

const base: StatusInput = { gstNumber: '24ABCDE1234F1Z5', gstRate: 18, upiId: 'shop@upi', address: 'Navrangpura', fssai: true, docsReady: true, eventTypes: 13, teamMembers: 1, undated: [], updates: 0 };

describe('settings search', () => {
  it('finds UPI in money and documents', () => {
    const hits = searchSettings('upi');
    expect(Array.from(hits.keys())).toEqual(['money', 'documents']);
    expect(hits.get('documents')).toEqual(['Invoice: UPI QR for the balance', 'UPI QR on quotes']);
  });

  it('needs every word to match and ignores case', () => {
    expect(Array.from(searchSettings('GST number').keys())).toEqual(['business']);
    expect(searchSettings('   ').size).toBe(0);
    expect(searchSettings('zzz').size).toBe(0);
  });

  it('matches a group title', () => {
    expect(searchSettings('reminders').get('reminders')).toHaveLength(4);
  });

  it('files every row under a known group', () => {
    const ids = GROUPS.map(g => g.id);
    expect(GROUPS).toHaveLength(8);
    SETTING_ROWS.forEach(r => expect(ids).toContain(r.group));
  });
});

describe('group notes', () => {
  it('is calm when everything is filled in', () => {
    const n = groupNotes(base);
    expect(Object.values(n).filter(x => x.warn)).toHaveLength(0);
    expect(n.money.note).toBe('GST 18%');
    expect(n.catering.note).toBe('13 event types · 3 food styles');
  });

  it('warns about a missing GST number only when registered', () => {
    expect(groupNotes({ ...base, gstNumber: '' }).business).toEqual({ note: 'GST number missing', warn: true });
    expect(groupNotes({ ...base, gstNumber: '', gstRate: 0 }).business.warn).toBe(false);
    expect(groupNotes({ ...base, address: '', fssai: false }).business.note).toBe('Shop address missing · 1 more');
  });

  it('flags an old GST slab and a missing UPI ID', () => {
    const n = groupNotes({ ...base, gstRate: 12, upiId: '' });
    expect(n.money).toEqual({ note: 'GST 12% is an old slab · no UPI ID yet', warn: true });
    expect(gstLabel(0)).toBe('Not GST-registered');
    expect(isOldSlab(5)).toBe(false);
  });

  it('names occasions without dates and pending database updates', () => {
    const n = groupNotes({ ...base, undated: ['Rakhi', 'Holi'], updates: 2, teamMembers: 0 });
    expect(n.sweets.note).toBe('Rakhi has no dates yet (+1)');
    expect(n.data).toEqual({ note: '2 database updates to run', warn: true });
    expect(n.team.note).toBe('0 team members for events');
  });
});
