import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import type { Quotation } from '../../hooks/useQuotations';
import { useDocSettings } from '../../hooks/useDocSettings';
import { useConfirm } from '../ui/ConfirmDialog';
import { siblingsOf } from '../../lib/quoteOptions';
import { dishCount } from '../../lib/quoteChoices';
import { openPicks } from '../../lib/quoteBoard';
import { readyChecks, quoteItems, coursesOf } from '../../lib/quoteSummary';
import { quotePdf } from '../../lib/quotationShare';
import { downloadDoc } from '../../lib/docs/output';
import { priceAt } from '../../lib/priceTiers';
import QuotationMultiDay from '../catering/QuotationMultiDay';
import { useAutosave } from './useAutosave';
import OptionTabs, { CompareTable } from './OptionTabs';
import EventSection, { Tick } from './EventSection';
import OneMealCard from './OneMealCard';
import PriceSection from './PriceSection';
import { PaymentSection, PdfSection } from './PlanSections';
import SummaryAside from './SummaryAside';
import { PackageDialog, CopyDialog } from './MenuSources';
import { usePackagePrice } from './usePackagePrice';
import { pdfSummary } from '../../lib/quoteSummary';
import { StatusChip, firstName } from './bits';
import { usePaymentRows } from '../../hooks/useBookingPayments';
import { useHasQuoteRevisions } from '../../hooks/useSchemaStatus';
import { sameAsRevision, snapshotOf } from '../../lib/quoteRevisions';
import { useUpdateBooking } from '../../hooks/useBookings';
import ReviseDialog from './ReviseDialog';
import { paymentsFor, receivedOf } from '../../lib/bookingMoney';
import { inr } from '../../lib/money';

interface Props {
  f: QuoteForm;
  session: number;
  hasOptions: boolean;
  pdfPrices: boolean;
  onPdfPrices: (on: boolean) => void;
  onSend: (q: Quotation, options?: Quotation[]) => void;
  onAddOption: (q: Quotation) => void | Promise<void>;
  onSwitch: (q: Quotation) => void;
  onClose: () => void;
  onOpenBooking?: (id: string) => void;
  onMarkSent?: (q: Quotation) => void;
}

const STATUS_TEXT = { saved: 'All changes saved', pending: 'Saving…', saving: 'Saving…', error: 'Couldn\'t save' };

// The quote editor: saves as you type, option tabs, sections and a sticky "Ready to send?".
const QuoteEditor: React.FC<Props> = ({ f, session, hasOptions, pdfPrices, onPdfPrices, onSend, onAddOption, onSwitch, onClose, onOpenBooking, onMarkSent }) => {
  const settings = useDocSettings();
  const { confirm, dialog } = useConfirm();
  const lastSaved = useRef<Quotation | null>(null);
  const save = async () => { const r = await f.handleSave(); if (r) lastSaved.current = r; return r; };
  // Declared before autosave: a locked accepted quote never saves, even from a drag.
  const [unlocked, setUnlocked] = useState(false);
  const lockedNow = f.editingQuotation?.status === 'accepted' && !unlocked;
  const auto = useAutosave({ session: String(session), snapshot: f.snapshot, ready: f.canSave && !lockedNow, save });
  useEffect(() => { lastSaved.current = null; }, [session]);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<'package' | 'copy' | null>(null);
  const pkg = usePackagePrice(f, session);
  // An accepted quote reads until you choose to change it.
  useEffect(() => { setUnlocked(false); }, [session]);
  const { data: payRows = [] } = usePaymentRows();

  const draft = f.draftQuotation();
  const siblings = f.editingQuotation ? siblingsOf(f.editingQuotation, f.quotations) : [];
  const live = siblings.map(s => (s.id === draft.id ? draft : s));
  const who = firstName(draft);
  const items = quoteItems(draft);
  const dishes = dishCount(items);
  const picks = openPicks(draft).map(p => p.label);
  const planPct = settings.schedule.length ? settings.schedule.reduce((s, x) => s + x.pct, 0) : null;
  const checks = readyChecks({
    date: f.isMultiDay ? (f.eventDays[0]?.date || '') : f.ev.draft.date, time: f.ev.draft.time, guests: f.guestCount, multiDay: f.isMultiDay,
    undated: f.eventDays.filter(d => !d.date).length, dishes, courses: coursesOf(items).length, picks, total: draft.total_amount, planPct,
  });
  const status = !f.editingId && auto.state === 'saved' ? 'Not saved yet — saves when you change something' : STATUS_TEXT[auto.state];
  // The saved quote (a brand-new one gets its id on the first save).
  const current = (): Quotation => (draft.id === 'draft' && lastSaved.current ? { ...draft, id: lastSaved.current.id, quotation_number: lastSaved.current.quotation_number } : draft);

  const accepted = f.editingQuotation?.status === 'accepted';
  const locked = accepted && !unlocked;
  const paid = receivedOf(paymentsFor(payRows, f.editingQuotation?.booking_id ?? ''));
  const revsReady = useHasQuoteRevisions();
  const updateBooking = useUpdateBooking();
  const [reviewing, setReviewing] = useState(false);
  const revs = f.editingQuotation?.revisions ?? [];
  // The accepted version is kept as a revision first, so every change can be undone.
  const unlock = async () => {
    const q = f.editingQuotation;
    if (!q || !(await confirm({ title: `Change ${q.quotation_number}?`, confirmLabel: 'Change it',
      message: `${who} accepted ${inr(q.total_amount)}${paid > 0 ? ` and ${inr(paid)} is received` : ''}. The accepted version is kept, changes save as you type and update the booking and kitchen sheet; an invoice already made keeps its own figures.` }))) return;
    try {
      if (revsReady) await f.updateQuotation.mutateAsync({ id: q.id, revisions: [...revs, snapshotOf(q, new Date().toISOString())] });
      setUnlocked(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not keep the accepted version'); }
  };
  const [leaving, setLeaving] = useState(false);
  const keep = async (sendNow: boolean) => {
    if (!(await flushed())) return;
    const q = f.editingQuotation;
    const last = revs[revs.length - 1];
    // Nothing changed after all: the kept version is not a revision.
    if (q && last && sameAsRevision(last, current())) await f.updateQuotation.mutateAsync({ id: q.id, revisions: revs.slice(0, -1) }).catch(() => undefined);
    setReviewing(false); setUnlocked(false);
    if (sendNow) onSend(current());
    if (leaving) onClose();
  };
  // Puts back the accepted version and forgets the revision made for this change.
  const undoAll = async () => {
    const q = f.editingQuotation;
    const last = revs[revs.length - 1];
    if (!q || !last) return;
    setBusy(true);
    try {
      const back = { ...(last.quote as Partial<Quotation>), revisions: revs.slice(0, -1) };
      const booking = q.booking && last.booking ? { ...q.booking, ...last.booking } : q.booking;
      if (q.booking_id && last.booking && Object.keys(last.booking).length) await updateBooking.mutateAsync({ id: q.booking_id, ...last.booking });
      const saved = await f.updateQuotation.mutateAsync({ id: q.id, ...back });
      f.openEdit({ ...q, ...back, ...(saved ?? {}), booking } as Quotation);
      if (q.booking_id && booking) f.ev.selectBooking(q.booking_id, q.is_multi_day ? undefined : Number(back.guest_count) || undefined, booking);
      if (leaving) onClose();
      setReviewing(false); setUnlocked(false);
      toast.success(`${q.quotation_number} is back to what ${who} accepted`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not undo'); } finally { setBusy(false); }
  };
  const flushed = async () => { if (await auto.flush()) return true; toast.error(auto.why()); return false; };
  const send = async () => { if (await flushed()) onSend(current(), live.length > 1 ? live.map(o => (o.id === draft.id ? current() : o)) : undefined); };
  const preview = () => downloadDoc(quotePdf(draft, pdfPrices));
  // Leaves once saved, or after you agree to drop what couldn't be saved.
  const leaveTo = async (go: () => void) => {
    if (!(await auto.flush()) && !(await confirm({ title: 'Leave without your last changes?', message: `They could not be saved: ${auto.why()}`, confirmLabel: 'Leave', danger: true }))) return;
    go();
  };
  // Leaving while changing an accepted quote shows the summary first.
  const leave = () => (accepted && unlocked ? (setLeaving(true), setReviewing(true)) : leaveTo(onClose));
  const addOption = async () => {
    if (!(await flushed())) return;
    setBusy(true);
    try { await onAddOption(current()); } finally { setBusy(false); }
  };
  const switchTo = async (q: Quotation) => { setCompare(false); if (await flushed()) onSwitch(q); };

  return (
    <div className="q-editor">
      <header className="q-ed-bar">
        <button type="button" className="q-back" onClick={leave} aria-label="Back to Quotations">← <span className="q-dk">Quotations</span></button>
        <span className="sep q-dk" />
        <span className="q-ed-title">
          <b>{f.editingQuotation?.quotation_number ?? lastSaved.current?.quotation_number ?? 'New quotation'} · {draft.customer?.name ?? who}</b>
          <span className={auto.state === 'error' ? 'err' : ''}>{status}{auto.state === 'error' && auto.error ? ` — ${auto.error}` : ''}</span>
        </span>
        {f.editingQuotation && <StatusChip q={f.editingQuotation} />}
        {auto.state === 'error' && <button type="button" className="ui-btn" onClick={() => auto.flush()}>Try again</button>}
        <span className="grow" />
        <button type="button" className="ui-btn q-dk" onClick={preview}>Preview PDF</button>
        <button type="button" className="ui-btn primary q-dk" disabled={!dishes} title={dishes ? undefined : 'Add a dish first'} onClick={send}>Send…</button>
      </header>

      <div className="q-ed">
        <OptionTabs current={draft} options={live} enabled={hasOptions} saved={!!(f.editingId || lastSaved.current)} compare={compare} busy={busy}
          name={f.optionName} onName={f.setOptionName} onSwitch={switchTo} onAdd={addOption} onCompare={setCompare} />
        {compare ? <CompareTable options={live} /> : (
          <div className="q-ed-cols">
            <div className="q-ed-main">
              {accepted && (
                <div role="status" className="q-warnbox q-lock">
                  <span>{locked ? <><b>{f.editingQuotation?.quotation_number} is accepted and locked{revs.length ? ` · revision ${revs.length + 1}` : ''}.</b> {who} confirmed {inr(f.editingQuotation?.total_amount ?? 0)}{paid > 0 ? ` · ${inr(paid)} received` : ''}.</> : <><b>Changing an accepted quote.</b> Send {who} the updated quote when you are done.</>}</span>
                  {locked ? <button type="button" className="ui-btn" onClick={unlock}>Change the accepted quote…</button>
                    : <button type="button" className="ui-btn primary" onClick={() => setReviewing(true)}>Done changing…</button>}
                </div>
              )}
              <fieldset className="q-fs" disabled={locked}>
              <EventSection f={f} onOpenBooking={onOpenBooking && (id => { leaveTo(() => onOpenBooking(id)); })} />
              <section className="q-sec" aria-label="Menu">
                <div className="q-sec-head">
                  <h2><Tick ok={dishes > 0} />Menu <small>{dishes} dish{dishes === 1 ? '' : 'es'}</small></h2>
                  {!f.isMultiDay && (
                    <span className="q-chips">
                      <button type="button" className="ui-btn" onClick={() => setSource('package')}>Start from a package</button>
                      <button type="button" className="ui-btn" onClick={() => setSource('copy')}>Copy from another quote</button>
                    </span>
                  )}
                </div>
                {f.isMultiDay ? (
                  <QuotationMultiDay eventDays={f.eventDays} setEventDays={f.setEventDays} guestCount={f.guestCount} defaultDate={f.selectedBooking?.event_date || f.ev.draft.date}
                    menuItems={f.activeItems} toLine={f.toLine} showPrices={f.showPrices} pdfPrices={pdfPrices} who={who} onOneMeal={f.toOne}
                    quotes={f.quotations} currentId={f.editingId} />
                ) : <OneMealCard f={f} who={who} pkg={pkg} pdfPrices={pdfPrices} onPdfPrices={onPdfPrices} />}
              </section>
              <PriceSection f={f} />
              <PaymentSection steps={settings.schedule} lo={draft.total_amount} hi={draft.total_max ?? null} />
              <PdfSection who={who} multi={f.isMultiDay} prices={pdfPrices} canPrice={f.hasItemPrices} onPrices={onPdfPrices} note={f.notes} onNote={f.setNotes} perMeal={pdfSummary(f.eventDays, pdfPrices)} />
              </fieldset>
            </div>
            <SummaryAside q={draft} checks={checks} picks={picks} who={who} dishPrices={pdfPrices}
              onMarkSent={onMarkSent && f.editingQuotation?.status === 'draft' ? () => onMarkSent(current()) : undefined} />
          </div>
        )}
      </div>

      <div className="q-phonebar">
        <button type="button" className="ui-btn" onClick={preview}>Preview</button>
        <button type="button" className="ui-btn primary" disabled={!dishes} onClick={send}>Send…</button>
      </div>

      {source === 'package' && (
        <PackageDialog menuItems={f.activeItems} hasDishes={f.selectedItems.length > 0} guests={f.guestCount} onClose={() => setSource(null)}
          onApply={(found, menu, replace, missing) => {
            f.applyPackage(found, priceAt(menu, f.guestCount), replace);
            pkg.link(menu);
            toast.success(`Added ${found.length} dish${found.length === 1 ? '' : 'es'}${missing.length ? ` · not in Menu Builder: ${missing.join(', ')}` : ''}`, { duration: 6000 });
          }} />
      )}
      {source === 'copy' && (
        <CopyDialog quotes={f.quotations} currentId={f.editingId} hasDishes={f.selectedItems.length > 0} onClose={() => setSource(null)} onCopy={f.copyItems} />
      )}
      {reviewing && f.editingQuotation && <ReviseDialog now={current()} last={revs[revs.length - 1]} paid={paid} who={who} busy={busy}
        onKeep={keep} onUndo={undoAll} onClose={() => { setReviewing(false); setLeaving(false); }} />}
      {dialog}
    </div>
  );
};

export default QuoteEditor;
