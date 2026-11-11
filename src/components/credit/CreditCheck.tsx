import React from 'react';
import { PosForm, Totals, creditPart } from '../../lib/posForm';
import { Account } from '../../lib/credit/accounts';
import { Check } from '../../lib/credit/checks';
import { addDays, shortDay } from '../../lib/credit/dates';
import { inr } from '../../lib/money';
import { inp } from '../ui/styles';
import './credit.css';

// What the counter needs to give credit: the customer's account, the check, pay-by, part paid now, owner override.
export interface PosCredit { check: Check; account?: Account; owner: boolean; today: string; payDays: number }

const DAYS: [number, string][] = [[3, '3 days'], [7, '1 week'], [15, '15 days'], [30, '1 month']];
const HEAD = { ok: 'Credit is fine', warn: 'Check before giving credit', block: 'Credit not allowed' };

export const blockedFor = (c: PosCredit, f: PosForm) => c.check.level === 'block' && (!c.owner || !(f.override ?? '').trim());

const CreditCheck: React.FC<{ c: PosCredit; form: PosForm; totals: Totals; set: (p: Partial<PosForm>) => void }> = ({ c, form, totals, set }) => {
  const { check, account: a } = c;
  const payBy = form.pay_by || addDays(c.today, c.payDays);
  const onCredit = creditPart(form, totals);
  const advance = Math.min(check.advance, Math.max(0, totals.due - totals.pay.cash - totals.pay.upi));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={`cr-check ${check.level}`} role={check.level === 'ok' ? 'status' : 'alert'}>
        <b>{check.level === 'block' && c.owner ? 'Over the rules: only you can allow it' : HEAD[check.level]}</b>
        <span className="kv"><span>Owes now</span><b>{inr(check.owed)}{a?.oldest ? ` · ${a.oldest} days` : ''}</b></span>
        <span className="kv"><span>After this bill</span><b>{inr(check.owed + onCredit)}</b></span>
        <span className="kv"><span>Limit</span><b>{a?.settings?.no_credit ? 'No credit' : check.limit != null ? inr(check.limit) : 'No limit'}</b></span>
        {check.reasons.map(r => <span key={r}>{r}</span>)}
        {check.level === 'block' && !c.owner && <span>Take cash or UPI, or hold the bill and ask the owner to allow it from their login.</span>}
      </div>

      {check.advance > 0 && advance > 0 && (
        <label className="check" style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: 14 }}>
          <input type="checkbox" style={{ width: 20, height: 20, accentColor: '#E8750A' }} checked={(form.use_advance ?? 0) > 0}
            onChange={e => set({ use_advance: e.target.checked ? advance : 0 })} />
          Use {inr(advance)} from their advance
        </label>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 6, alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#4A4A45' }}>Paying some now? (optional)
          <input style={{ ...inp, minHeight: 44, fontSize: 15 }} inputMode="decimal" placeholder="₹0" value={form.credit_now ?? ''} onChange={e => set({ credit_now: e.target.value })} />
        </label>
        <span className="cr-pick" role="group" aria-label="Paid now by">
          {(['cash', 'upi'] as const).map(m => (
            <button key={m} type="button" aria-pressed={(form.credit_mode ?? 'cash') === m} onClick={() => set({ credit_mode: m })}>{m === 'upi' ? 'UPI' : 'Cash'}</button>
          ))}
        </span>
      </div>

      {onCredit > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#4A4A45' }}>Pay by · {shortDay(payBy, c.today)}</span>
          <span className="cr-pick" role="group" aria-label="Pay by">
            {DAYS.map(([d, l]) => <button key={d} type="button" aria-pressed={payBy === addDays(c.today, d)} onClick={() => set({ pay_by: addDays(c.today, d) })}>{l}</button>)}
            <input type="date" aria-label="Pick a pay-by date" min={c.today} value={payBy} style={{ ...inp, width: 'auto', minHeight: 44 }} onChange={e => set({ pay_by: e.target.value })} />
          </span>
        </div>
      )}

      {check.level === 'block' && c.owner && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: '#4A4A45' }}>Why allow it? (kept in the account)
          <input style={{ ...inp, minHeight: 44, fontSize: 15 }} value={form.override ?? ''} placeholder="e.g. regular customer, pays monthly" onChange={e => set({ override: e.target.value })} />
        </label>
      )}
    </div>
  );
};

export default CreditCheck;
