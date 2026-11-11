import React, { useMemo, useState } from 'react';
import { Account } from '../../lib/credit/accounts';
import { addDays } from '../../lib/credit/dates';
import { CreditAccount, CreditSettings, Lang } from '../../lib/credit/types';
import { inr, isValidPhone, cleanPhone } from '../../lib/money';
import { Dlg, Field, Pick, amountOf } from './Fields';
import { OpeningInput } from './useCreditActions';

type LimitKind = 'shop' | 'own' | 'none';

// Owner: this customer's limit, whether they get credit, dispute and reminder language.
export const SettingsDialog: React.FC<{ a: Account; shop: CreditSettings; onClose: () => void; onSave: (p: Partial<CreditAccount>) => Promise<unknown> }> = ({ a, shop, onClose, onSave }) => {
  const s = a.settings;
  const [kind, setKind] = useState<LimitKind>(s?.credit_limit == null ? 'shop' : s.credit_limit > 0 ? 'own' : 'none');
  const [limit, setLimit] = useState(String(s?.credit_limit && s.credit_limit > 0 ? s.credit_limit : shop.limit || ''));
  const [allow, setAllow] = useState(!s?.no_credit);
  const [disputed, setDisputed] = useState(!!s?.disputed);
  const [lang, setLang] = useState<Lang>(s?.lang ?? shop.lang);
  const [note, setNote] = useState(s?.note ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await onSave({ credit_limit: kind === 'shop' ? null : kind === 'none' ? 0 : amountOf(limit), no_credit: !allow, disputed, lang, note: note.trim() || null });
    setBusy(false); onClose();
  };
  return (
    <Dlg title={`Credit settings · ${a.name}`} onClose={onClose} busy={busy} disabled={kind === 'own' && amountOf(limit) <= 0} primary="Save" onSave={save}>
      <Pick label="Credit limit" value={kind} onChange={setKind}
        options={[['shop', shop.limit > 0 ? `Shop default ${inr(shop.limit)}` : 'Shop default (none)'], ['own', 'Own limit'], ['none', 'No limit']]} />
      {kind === 'own' && <Field label="Own limit (₹)"><input inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} /></Field>}
      <label className="check"><input type="checkbox" checked={allow} onChange={e => setAllow(e.target.checked)} />Allow credit for this customer</label>
      <Pick label="Status" value={disputed ? 'disputed' : 'active'} options={[['active', 'Active'], ['disputed', 'Disputed (no reminders)']]} onChange={v => setDisputed(v === 'disputed')} />
      <Pick label="Reminder language" value={lang} options={[['en', 'English'], ['hi', 'हिंदी (Hindi)']]} onChange={setLang} />
      <Field label="Note for the counter"><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></Field>
    </Dlg>
  );
};

// Owner: let go of part of what is owed (discount) or write it off as bad debt.
export const WriteOffDialog: React.FC<{ a: Account; onClose: () => void; onSave: (amount: number, bad: boolean, reason: string) => Promise<unknown> }> = ({ a, onClose, onSave }) => {
  const [bad, setBad] = useState(false);
  const [text, setText] = useState(String(a.owed));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = Math.min(a.owed, amountOf(text));
  const save = async () => { setBusy(true); await onSave(amount, bad, reason.trim()); setBusy(false); onClose(); };
  return (
    <Dlg title={`Let go of credit for ${a.name}?`} onClose={onClose} busy={busy} danger disabled={amount <= 0 || !reason.trim()}
      primary={`${bad ? 'Write off' : 'Let go of'} ${inr(amount)}`} onSave={save}>
      <span className="note">Owes {inr(a.owed)} · oldest {a.oldest} days</span>
      <Pick label="Kind" value={bad ? 'bad' : 'discount'} options={[['discount', 'Discount / round-off'], ['bad', 'Bad debt']]} onChange={v => setBad(v === 'bad')} />
      <Field label="Amount (₹)"><input inputMode="decimal" value={text} onChange={e => setText(e.target.value)} /></Field>
      <Field label="Reason"><textarea rows={2} value={reason} placeholder={bad ? 'e.g. moved away, not reachable' : 'e.g. rounded off'} onChange={e => setReason(e.target.value)} /></Field>
      <span className="note">Clears the oldest bills first. It is no money in, and shows in the account and the Credit report. Undo it from the account.</span>
    </Dlg>
  );
};

// Money owed from before the app (the paper register); not counted as a sale.
export const OpeningDialog: React.FC<{ people: { name: string; phone: string }[]; today: string; shop: CreditSettings; preset?: { name: string; phone: string }; onClose: () => void; onSave: (o: OpeningInput) => Promise<unknown> }> =
  ({ people, today, shop, preset, onClose, onSave }) => {
    const [name, setName] = useState(preset?.name ?? '');
    const [phone, setPhone] = useState(preset?.phone ?? '');
    const [text, setText] = useState('');
    const [since, setSince] = useState(today);
    const [days, setDays] = useState(String(shop.pay_days));
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const match = useMemo(() => people.find(p => cleanPhone(p.phone) === cleanPhone(phone)), [people, phone]);
    const amount = amountOf(text);
    const ok = name.trim() && isValidPhone(phone) && amount > 0 && since <= today;
    const save = async () => {
      setBusy(true);
      await onSave({ name: name.trim(), phone: cleanPhone(phone), amount, at: since, due_date: addDays(today, Number(days) || 0), note: note.trim() });
      setBusy(false); onClose();
    };
    return (
      <Dlg title="Add old balance" onClose={onClose} busy={busy} disabled={!ok} primary={amount > 0 ? `Add ${inr(amount)} to the account` : 'Add old balance'} onSave={save}>
        <span className="note">Money owed from before the app, e.g. from the paper register. It is not counted as a sale.</span>
        <div className="grid2">
          <Field label="Customer name"><input value={name} onChange={e => setName(e.target.value)} list="cr-people" /></Field>
          <Field label="Mobile"><input inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); const p = people.find(x => cleanPhone(x.phone) === cleanPhone(e.target.value)); if (p && !name) setName(p.name); }} /></Field>
          <Field label="Amount owed (₹)"><input inputMode="decimal" value={text} onChange={e => setText(e.target.value)} /></Field>
          <Field label="Owed since"><input type="date" value={since} max={today} onChange={e => setSince(e.target.value || today)} /></Field>
        </div>
        <datalist id="cr-people">{people.slice(0, 200).map(p => <option key={p.phone} value={p.name}>{p.phone}</option>)}</datalist>
        {phone && !isValidPhone(phone) && <span className="note cr-red">Type a 10-digit mobile number.</span>}
        {match && <span className="note">Matches {match.name}, already saved.</span>}
        <Pick label="Pay by" value={days} options={[['7', '1 week'], ['15', '15 days'], ['30', '1 month']]} onChange={setDays} />
        <Field label="Note"><input value={note} placeholder="e.g. register 2025, page 14" onChange={e => setNote(e.target.value)} /></Field>
      </Dlg>
    );
  };
