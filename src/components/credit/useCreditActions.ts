import toast from 'react-hot-toast';
import { useAddCreditEntry, useApplyPatches, useSaveCreditAccount, useUpdateCreditEntry } from '../../hooks/useCredit';
import { useMyRole } from '../../hooks/useMyRole';
import { useDocSettings } from '../../hooks/useDocSettings';
import { PayMode, PayKind } from '../../lib/payments';
import { Account } from '../../lib/credit/accounts';
import { allocate, patchesFor, undoPatches } from '../../lib/credit/allocate';
import { CreditItem } from '../../lib/credit/items';
import { creditReminder } from '../../lib/credit/messages';
import { CallOutcome, CreditAccount, CreditEntry, CreditEntryPayload, Lang } from '../../lib/credit/types';
import { openWhatsApp } from '../../lib/receipt';
import { SHOP } from '../../lib/shop';
import { inr } from '../../lib/money';
import { roundMoney } from '../../lib/units';
import { todayIST } from '../../lib/ist';
import { errorText } from '../../lib/errors';
import { undoToast } from '../pos/undoToast';

export interface ReceiveInput { amount: number; mode: PayMode; at: string; note?: string; firstId?: string; letGo?: boolean }
export interface OpeningInput { name: string; phone: string; amount: number; at: string; due_date: string; note: string }

const newId = () => (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Open items after some links were paid off.
const afterLinks = (open: CreditItem[], links: { id: string; amount: number }[]) =>
  open.map(i => ({ ...i, due: roundMoney(i.due - links.filter(l => l.id === i.id).reduce((s, l) => s + l.amount, 0)) })).filter(i => i.due > 0);

// Everything a person can do on a credit account; each write is one entry plus its bill payments.
export function useCreditActions() {
  const add = useAddCreditEntry();
  const update = useUpdateCreditEntry();
  const saveAcc = useSaveCreditAccount();
  const apply = useApplyPatches();
  const { email } = useMyRole();
  const doc = useDocSettings();

  const entry = (a: Pick<Account, 'phone' | 'name'>, row: Partial<CreditEntryPayload> & Pick<CreditEntryPayload, 'kind'> & { id?: string }) =>
    add.mutateAsync({ phone: a.phone, name: a.name, by_email: email || null, at: new Date().toISOString(), ...row });

  // Settles links with tagged payments under one new entry.
  const settle = async (a: Account, kind: 'receipt' | 'writeoff' | 'note', amount: number, links: ReturnType<typeof allocate>['links'], pay: { mode: PayMode; at: string; kind: PayKind; note?: string }) => {
    const id = newId();
    await entry(a, { id, kind, amount, mode: kind === 'receipt' ? pay.mode : null, links, note: pay.note ?? null, at: pay.at });
    const patches = patchesFor(a.items, links, { ...pay, ref: id });
    await apply(patches);
    // The account as it is now, for a follow-up write in the same action.
    const items = a.items.map(i => ({ ...i, payments: patches.find(p => p.item.id === i.id && p.item.type === i.type)?.payments ?? i.payments }));
    return { id, next: { ...a, items } };
  };

  const undo = async (a: Account, e: Pick<CreditEntry, 'id' | 'links'>) => {
    await apply(undoPatches(a.items, e.links, e.id));
    await update.mutateAsync({ id: e.id, voided_at: new Date().toISOString() });
  };

  const run = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    try { return await work(); } catch (e) { toast.error(errorText(e)); return undefined; }
  };

  const receive = (a: Account, r: ReceiveInput) => run(async () => {
    const { links, left } = allocate(a.open, r.amount, r.firstId);
    const { id, next } = await settle(a, 'receipt', r.amount, links, { mode: r.mode, at: r.at, kind: 'due', note: r.note });
    const rest = afterLinks(a.open, links);
    const restDue = roundMoney(rest.reduce((s, i) => s + i.due, 0));
    if (r.letGo && restDue > 0) {
      await settle(next, 'writeoff', restDue, allocate(rest, restDue).links, { mode: 'cash', at: r.at, kind: 'writeoff', note: 'Discount: let go when settling' });
    }
    undoToast(left > 0 ? `${inr(r.amount)} received · ${inr(left)} kept as advance` : `${inr(r.amount)} received from ${a.name}`, () => {
      run(() => undo(a, { id, links }));
    });
  });

  const writeOff = (a: Account, amount: number, bad: boolean, reason: string) => run(async () => {
    const { links } = allocate(a.open, amount);
    await settle(a, 'writeoff', amount, links, { mode: 'cash', at: new Date().toISOString(), kind: 'writeoff', note: `${bad ? 'Bad debt' : 'Discount'}: ${reason}` });
    toast.success(`${inr(amount)} ${bad ? 'written off' : 'let go'} for ${a.name}`);
  });

  // Pays the oldest dues from money they paid in advance.
  const payFromAdvance = (a: Account) => run(async () => {
    const amount = Math.min(a.advance, a.owed);
    const { links } = allocate(a.open, amount);
    await settle(a, 'note', 0, links, { mode: 'cash', at: new Date().toISOString(), kind: 'from_advance', note: `Paid ${inr(amount)} from advance` });
    toast.success(`${inr(amount)} paid from ${a.name}'s advance`);
  });

  const promise = (a: Account, date: string, amount: number, note: string) => run(async () => {
    await entry(a, { kind: 'promise', promise_date: date, amount, note: note || null });
    toast.success(`Promise saved · follow up on ${date}`);
  });

  const saveAccount = (a: Pick<Account, 'phone' | 'name' | 'settings'>, patch: Partial<CreditAccount>) => run(() => saveAcc.mutateAsync({
    phone: a.phone, name: a.name, credit_limit: null, no_credit: false, disputed: false, lang: doc.credit.lang, note: null, ...a.settings, ...patch,
  }));

  const call = (a: Account, outcome: CallOutcome, note: string) => run(async () => {
    await entry(a, { kind: 'call', outcome, note: note || null });
    if (outcome === 'disputed') await saveAccount(a, { disputed: true });
    toast.success('Call saved');
  });

  const reminderFor = (a: Account, lang: Lang) => creditReminder(a, lang, { name: doc.sweets_name || SHOP.name, phone: SHOP.phone, upi: doc.upi_id.trim() }, todayIST());

  // Opens WhatsApp with the message and logs the reminder.
  const remind = (a: Account, lang: Lang = a.settings?.lang ?? doc.credit.lang, text = reminderFor(a, lang)) => {
    const opened = openWhatsApp(a.phone, text);
    run(() => entry(a, { kind: 'reminder', amount: a.owed, note: lang === 'hi' ? 'Hindi' : 'English' }));
    return opened;
  };

  const addOpening = (o: OpeningInput) => run(async () => {
    await entry({ phone: o.phone, name: o.name }, { kind: 'opening', amount: o.amount, at: `${o.at}T12:00:00+05:30`, due_date: o.due_date || null, note: o.note || null });
    toast.success(`${inr(o.amount)} old balance added for ${o.name}`);
  });

  const note = (a: Pick<Account, 'phone' | 'name'>, kind: 'note' | 'override', text: string, amount = 0) => run(() => entry(a, { kind, note: text, amount }));

  return { receive, undo: (a: Account, e: CreditEntry) => run(() => undo(a, e)), writeOff, payFromAdvance, promise, call, remind, reminderFor, saveAccount, addOpening, note, busy: add.isPending || update.isPending };
}
