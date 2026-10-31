import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import type { Quotation, QuotationLineItem } from '../../hooks/useQuotations';
import { useDocSettings } from '../../hooks/useDocSettings';
import { useConfirm } from '../ui/ConfirmDialog';
import { siblingsOf } from '../../lib/quoteOptions';
import { plateRange, ownRange, dishCount } from '../../lib/quoteChoices';
import { openPicks } from '../../lib/quoteBoard';
import { readyChecks, quoteItems, coursesOf, range } from '../../lib/quoteSummary';
import { quotePdf } from '../../lib/quotationShare';
import { downloadDoc } from '../../lib/docs/output';
import { priceAt } from '../../lib/priceTiers';
import QuotationMultiDay from '../catering/QuotationMultiDay';
import { useAutosave } from './useAutosave';
import OptionTabs, { CompareTable } from './OptionTabs';
import EventSection, { Tick } from './EventSection';
import MenuCourses from './MenuCourses';
import PriceSection from './PriceSection';
import { PaymentSection, PdfSection } from './PlanSections';
import SummaryAside from './SummaryAside';
import { PackageDialog, CopyDialog } from './MenuSources';
import { usePackagePrice } from './usePackagePrice';
import { StatusChip, firstName } from './bits';

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
}

const STATUS_TEXT = { saved: 'All changes saved', pending: 'Saving…', saving: 'Saving…', error: 'Couldn\'t save' };

// The quote editor: saves as you type, option tabs, sections and a sticky "Ready to send?".
const QuoteEditor: React.FC<Props> = ({ f, session, hasOptions, pdfPrices, onPdfPrices, onSend, onAddOption, onSwitch, onClose, onOpenBooking }) => {
  const settings = useDocSettings();
  const { confirm, dialog } = useConfirm();
  const lastSaved = useRef<Quotation | null>(null);
  const save = async () => { const r = await f.handleSave(); if (r) lastSaved.current = r; return r; };
  const auto = useAutosave({ session: String(session), snapshot: f.snapshot, ready: f.canSave, save });
  useEffect(() => { lastSaved.current = null; }, [session]);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<'package' | 'copy' | null>(null);
  const pkg = usePackagePrice(f, session);

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

  const flushed = async () => { if (await auto.flush()) return true; toast.error(auto.why()); return false; };
  const send = async () => { if (await flushed()) onSend(current(), live.length > 1 ? live.map(o => (o.id === draft.id ? current() : o)) : undefined); };
  const preview = () => downloadDoc(quotePdf(draft, pdfPrices));
  // Leaves once saved, or after you agree to drop what couldn't be saved.
  const leaveTo = async (go: () => void) => {
    if (!(await auto.flush()) && !(await confirm({ title: 'Leave without your last changes?', message: `They could not be saved: ${auto.why()}`, confirmLabel: 'Leave', danger: true }))) return;
    go();
  };
  const leave = () => leaveTo(onClose);
  const addOption = async () => {
    if (!(await flushed())) return;
    setBusy(true);
    try { await onAddOption(current()); } finally { setBusy(false); }
  };
  const switchTo = async (q: Quotation) => { setCompare(false); if (await flushed()) onSwitch(q); };
  const oneMeal = async () => {
    const meals = f.eventDays.reduce((s, d) => s + d.meals.length, 0);
    if (meals && !(await confirm({ title: 'Switch to one meal?', message: `The ${meals} meal${meals > 1 ? 's' : ''} and their dishes are removed from this quote.`, confirmLabel: 'Switch', danger: true }))) return;
    f.toggleMultiDay(false);
  };
  const platePreview = (next: QuotationLineItem[]) => {
    if (f.showPrices && f.autoPrice) { const r = plateRange(next); return `${range(r.min, r.max)} a plate`; }
    const r = ownRange(parseFloat(f.perPlate) || 0, next);
    return `${range(r.low, r.high)} a plate`;
  };

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
              <EventSection f={f} onOpenBooking={onOpenBooking && (id => { leaveTo(() => onOpenBooking(id)); })} onSeveralDays={() => f.toggleMultiDay(true)} />
              <section className="q-sec" aria-label="Menu">
                <div className="q-sec-head">
                  <h2><Tick ok={dishes > 0} />Menu <small>{dishes} dish{dishes === 1 ? '' : 'es'}</small></h2>
                  {f.isMultiDay ? (
                    <div className="q-seg" role="radiogroup" aria-label="Menu shape">
                      <button type="button" role="radio" aria-checked={false} onClick={oneMeal}>One meal</button>
                      <button type="button" role="radio" aria-checked className="on">Several meals or days</button>
                    </div>
                  ) : (
                    <span className="q-chips">
                      <button type="button" className="ui-btn" onClick={() => setSource('package')}>Start from a package</button>
                      <button type="button" className="ui-btn" onClick={() => setSource('copy')}>Copy from another quote</button>
                    </span>
                  )}
                </div>
                {f.isMultiDay ? (
                  <QuotationMultiDay eventDays={f.eventDays} setEventDays={f.setEventDays} guestCount={f.guestCount} defaultDate={f.selectedBooking?.event_date || f.ev.draft.date}
                    menuItems={f.activeItems} toLine={f.toLine} showPrices={f.showPrices} who={who} />
                ) : <>
                  <MenuCourses items={f.selectedItems} menu={f.activeItems} showPrices={f.showPrices} who={who} toLine={f.toLine} preview={platePreview} onChange={f.setSelectedItems} />
                  <span className="q-hint">Tap a dish to set its price, note or "served with" items. Dishes with no price are part of the plate price and never show ₹0 on the PDF.</span>
                </>}
              </section>
              <PriceSection f={f} pkg={pkg} />
              <PaymentSection steps={settings.schedule} lo={draft.total_amount} hi={draft.total_max ?? null} />
              <PdfSection who={who} prices={pdfPrices} canPrice={f.hasItemPrices} onPrices={onPdfPrices} note={f.notes} onNote={f.setNotes} />
            </div>
            <SummaryAside q={draft} checks={checks} picks={picks} who={who} />
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
      {dialog}
    </div>
  );
};

export default QuoteEditor;
