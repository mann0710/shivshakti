import React, { useMemo } from 'react';
import toast from 'react-hot-toast';
import NoteCounter from './NoteCounter';
import { useDayCloses, useCloseDay, useReopenDay } from './useDayCloses';
import { useSeasonalOrders, useHasPosPayments, POS_MIGRATION_FILE } from '../../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../../hooks/useSeasonalPreorders';
import { useStoredState } from '../../hooks/useStoredState';
import { useConfirm } from '../ui/ConfirmDialog';
import {
  DayClose, NoteCounts, openWindow, summarize, expectedOf, countedOf, buildClose, differenceOf, differenceLabel, dayLabel, whenLabel,
} from '../../lib/dayClose';
import { dayCloseSlipHtml } from '../../lib/thermalSlips';
import { printHtml } from '../../lib/receipt';
import { inr } from '../../lib/money';
import { roundMoney } from '../../lib/units';
import { inp, DANGER, SUCCESS } from '../ui/styles';

interface Draft { day: string; opening: string; cashOut: string; cashOutNote: string; notes: NoteCounts; keep: string; note: string }
const emptyDraft = (day = ''): Draft => ({ day, opening: '', cashOut: '', cashOutNote: '', notes: {}, keep: '', note: '' });
const cell: React.CSSProperties = { ...inp, width: 130, minHeight: 44, textAlign: 'right' };
const num = (v: string) => Math.max(0, roundMoney(Number(v) || 0));
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

const Line: React.FC<{ label: string; value: string; strong?: boolean; children?: React.ReactNode }> = ({ label, value, strong, children }) => (
  <div className={`dc-row${strong ? ' total' : ''}`}><span>{label}</span>{children ?? <span>{value}</span>}</div>
);

// Count the drawer against what should be there, check UPI, then close the day and print the 80 mm summary.
const DayCloseTab: React.FC = () => {
  const ready = useHasPosPayments();
  const { data: closes = [], isLoading } = useDayCloses(ready);
  const { data: orders = [] } = useSeasonalOrders();
  const { data: preorders = [] } = useSeasonalPreorders();
  const closeDay = useCloseDay();
  const reopen = useReopenDay();
  const { confirm, dialog } = useConfirm();
  const [stored, setStored] = useStoredState<Draft>('sessional-dayclose-draft', () => emptyDraft());

  const win = useMemo(() => openWindow(closes, new Date()), [closes]);
  const sum = useMemo(() => summarize(orders, preorders, win.from, new Date().toISOString()), [orders, preorders, win.from]);
  const draft = stored.day === win.day ? stored : emptyDraft(win.day);
  const set = (patch: Partial<Draft>) => setStored({ ...draft, ...patch, day: win.day });

  const opening = draft.opening === '' ? win.last?.keep_cash ?? 0 : num(draft.opening);
  const cashOut = num(draft.cashOut);
  const expected = expectedOf(opening, sum, cashOut);
  const counted = countedOf(draft.notes);
  const diff = roundMoney(counted - expected);
  const keep = draft.keep === '' ? Math.min(opening, counted) : num(draft.keep);

  if (!ready) {
    return <div className="pos-note">Day close needs a one-time database update: run <code>{POS_MIGRATION_FILE}</code> in Supabase → SQL Editor.</div>;
  }
  if (isLoading) return <div style={{ color: '#5A5A55' }}>Loading…</div>;

  const close = async () => {
    if (!counted && !(await confirm({ title: 'Drawer not counted', message: 'Count the notes first, or close with ₹0 counted?', confirmLabel: 'Close anyway' }))) return;
    const at = new Date().toISOString();
    const row = buildClose(win, summarize(orders, preorders, win.from, at), { opening, cashOut, cashOutNote: draft.cashOutNote, notes: draft.notes, keep, note: draft.note }, at);
    try {
      await closeDay.mutateAsync(row);
      printHtml(dayCloseSlipHtml(row));
      setStored(emptyDraft());
      toast.success(`${dayLabel(row.day)} closed`);
    } catch (e) { toast.error(errorText(e)); }
  };

  const reopenDay = async (c: DayClose) => {
    if (!(await confirm({ title: `Reopen ${dayLabel(c.day)}?`, message: 'Only the owner should do this. Money since that close counts for this day again, and the day must be closed again.', confirmLabel: 'Reopen day', danger: true }))) return;
    try { await reopen.mutateAsync(c.id); toast.success('Day reopened'); } catch (e) { toast.error(errorText(e)); }
  };

  const last = win.last;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {last && (
        <div className="dc-card" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <b>{dayLabel(last.day)} closed</b> at {whenLabel(last.closed_at)}
            <div style={{ color: '#5A5A55' }}>Counted {inr(last.counted_cash)} · {differenceLabel(differenceOf(last))}{differenceOf(last) ? ` ${inr(Math.abs(differenceOf(last)))}` : ''} · kept {inr(last.keep_cash)} · UPI {inr(last.upi_total)}</div>
          </div>
          <button type="button" className="ui-btn" onClick={() => printHtml(dayCloseSlipHtml(last))}>Print again</button>
          <button type="button" className="ui-btn warn" disabled={reopen.isPending} onClick={() => reopenDay(last)}>Reopen day</button>
        </div>
      )}

      <div className="dc-layout">
        <section className="dc-card" aria-label="Cash expected">
          <div style={{ fontSize: 16, fontWeight: 700 }}>{dayLabel(win.day)}</div>
          <div style={{ fontSize: 12, color: '#5A5A55' }}>Counting since {whenLabel(win.from)}{last ? ' (last close)' : ''}. Bills after closing count for the next day.</div>
          <Line label="Opening cash" value="">
            <input style={cell} inputMode="decimal" value={draft.opening === '' ? String(opening) : draft.opening}
              aria-label="Opening cash" onChange={e => set({ opening: e.target.value })} onFocus={e => e.target.select()} />
          </Line>
          <Line label="+ Cash from bills" value={inr(sum.cash_bills)} />
          <Line label="+ Pre-booking advances" value={inr(sum.cash_advances)} />
          <Line label="+ Hand-over balances" value={inr(sum.cash_handover)} />
          <Line label="+ Old dues collected" value={inr(sum.cash_dues)} />
          <Line label="− Cash taken out" value="">
            <input style={cell} inputMode="decimal" value={draft.cashOut} placeholder="0" aria-label="Cash taken out"
              onChange={e => set({ cashOut: e.target.value })} />
          </Line>
          {cashOut > 0 && <input style={{ ...inp, minHeight: 44 }} value={draft.cashOutNote} placeholder="What for? (e.g. milk, staff tea)" aria-label="Cash taken out for"
            onChange={e => set({ cashOutNote: e.target.value })} />}
          <Line label="Should be in the drawer" value={inr(expected)} strong />
          <div className="pos-note" style={{ background: '#F4F6FF', borderColor: '#D5DBF5', color: '#1A1A18' }}>
            UPI received <b>{inr(sum.upi_total)}</b> in {sum.upi_count} payment{sum.upi_count === 1 ? '' : 's'}. Check this against your UPI app.
          </div>
          <div style={{ fontSize: 12, color: '#5A5A55' }}>
            {sum.bills_count} bill{sum.bills_count === 1 ? '' : 's'} · sold {inr(sum.sales_total)}{sum.unpaid_total ? ` · ${inr(sum.unpaid_total)} left unpaid` : ''}
          </div>
        </section>

        <section className="dc-card" aria-label="Count the drawer">
          <div style={{ fontSize: 16, fontWeight: 700 }}>Count the drawer</div>
          <NoteCounter counts={draft.notes} onChange={notes => set({ notes })} />
          <Line label="Difference" value="">
            <b style={{ color: diff === 0 ? SUCCESS : DANGER }}>{differenceLabel(diff)}{diff ? ` ${inr(Math.abs(diff))}` : ''}</b>
          </Line>
          <Line label="Keep for tomorrow" value="">
            <input style={cell} inputMode="decimal" value={draft.keep === '' ? String(keep) : draft.keep} aria-label="Keep for tomorrow"
              onChange={e => set({ keep: e.target.value })} onFocus={e => e.target.select()} />
          </Line>
          <Line label="Take out now" value={inr(Math.max(0, roundMoney(counted - keep)))} />
          <input style={{ ...inp, minHeight: 44 }} value={draft.note} placeholder="Note (optional)" aria-label="Day note" onChange={e => set({ note: e.target.value })} />
          <button type="button" className="pos-charge" disabled={closeDay.isPending} onClick={close}>
            {closeDay.isPending ? 'Closing…' : 'Close the day and print summary'}
          </button>
        </section>
      </div>
      {dialog}
    </div>
  );
};

export default DayCloseTab;
