import React from 'react';
import type { PayStep } from '../../lib/docs/settings';
import { planRows } from '../../lib/quoteSummary';
import { Tick } from './EventSection';

// Payment plan from Settings, split on this quote's total.
export const PaymentSection: React.FC<{ steps: PayStep[]; lo: number; hi: number | null }> = ({ steps, lo, hi }) => {
  const pct = steps.reduce((s, x) => s + x.pct, 0);
  return (
    <section className="q-sec" aria-label="Payment plan">
      <div className="q-sec-head">
        <h2><Tick ok={pct === 100} />Payment plan</h2>
        <span className="q-hint">{steps.map(s => s.pct).join(' · ') || 'None'} · from Settings</span>
      </div>
      {steps.length ? planRows(lo, hi, steps).map((r, i) => (
        <div key={i} className="q-plan"><span className="p">{r.pct}</span><span>{r.text}</span><span className="a">{r.amount}</span></div>
      )) : <p className="q-hint">No payment plan yet. Add one in Settings → Documents.</p>}
    </section>
  );
};

interface PdfProps { who: string; prices: boolean; canPrice: boolean; onPrices: (on: boolean) => void; note: string; onNote: (v: string) => void }

// What prints on the PDF: dish prices or only the plate price, and a note.
export const PdfSection: React.FC<PdfProps> = ({ who, prices, canPrice, onPrices, note, onNote }) => (
  <section className="q-sec" aria-label="On the PDF">
    <h2>On the PDF</h2>
    <label className="q-check">
      <input type="checkbox" checked={prices && canPrice} disabled={!canPrice} onChange={e => onPrices(e.target.checked)} />
      Show each dish's price (off: only the plate price shows)
    </label>
    <label className="q-field">Note for {who}
      <textarea rows={2} value={note} onChange={e => onNote(e.target.value)} placeholder="Printed under the menu, e.g. live counter on request" />
    </label>
  </section>
);
