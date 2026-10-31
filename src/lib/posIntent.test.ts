import { posLink, posStart } from './posIntent';

const who = { name: 'Krinal', phone: '9876543210' };

describe('posStart', () => {
  it('opens the counter as a bill when nothing is asked', () => {
    expect(posStart(null)).toEqual({ tab: 'pos' });
    expect(posStart({ action: 'open', id: 'something-old' })).toEqual({ tab: 'pos' });
  });

  it('opens a new pre-booking or bill, with the customer filled in', () => {
    expect(posStart(posLink.preorder())).toEqual({ tab: 'pos', mode: 'preorder', who: undefined });
    expect(posStart(posLink.bill(who))).toEqual({ tab: 'pos', mode: 'bill', who });
  });

  it('opens bills and pre-bookings, optionally one pre-booking', () => {
    expect(posStart(posLink.bills(who))).toEqual({ tab: 'orders', who });
    expect(posStart(posLink.preorders())).toEqual({ tab: 'preorders', who: undefined, openId: undefined });
    expect(posStart(posLink.preorders('p1', who))).toEqual({ tab: 'preorders', who, openId: 'p1' });
  });

  it('opens day close and a chosen report', () => {
    expect(posStart(posLink.close())).toEqual({ tab: 'close' });
    expect(posStart(posLink.report('dues'))).toEqual({ tab: 'reports', report: 'dues' });
    expect(posStart(posLink.report())).toEqual({ tab: 'reports', report: undefined });
  });
});
