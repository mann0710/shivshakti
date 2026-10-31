import React, { useEffect, useState } from 'react';
import { PayStep } from '../../lib/docs/settings';
import { GST_SLABS, isOldSlab } from '../../lib/settingsIndex';
import { Field, Panel, Row, Soon } from './SettingsUi';
import { SettingsApi } from './useSettingsSave';

const UPI_RE = /^[\w.-]{2,}@[a-zA-Z][\w.-]*$/;

// Advance / before / after split; saved only once it adds up to 100%.
const PlanEditor: React.FC<{ steps: PayStep[]; disabled: boolean; onSave: (s: PayStep[]) => void }> = ({ steps, disabled, onSave }) => {
  const [rows, setRows] = useState(steps);
  useEffect(() => { setRows(steps); }, [steps]);
  const total = rows.reduce((t, x) => t + (Number(x.pct) || 0), 0);
  const commit = (next = rows) => {
    const clean = next.filter(x => x.pct > 0);
    if (clean.reduce((t, x) => t + x.pct, 0) === 100 && JSON.stringify(clean) !== JSON.stringify(steps)) onSave(clean);
  };
  const set = (i: number, patch: Partial<PayStep>) => setRows(r => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="st-plan">
      {rows.map((x, i) => (
        <div key={i} className="st-plan-row">
          <input aria-label={`Step ${i + 1} percent`} inputMode="numeric" value={x.pct || ''} disabled={disabled} onBlur={() => commit()}
            onChange={e => set(i, { pct: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          <input aria-label={`Step ${i + 1} name`} value={x.label} placeholder="Advance" disabled={disabled} onBlur={() => commit()} onChange={e => set(i, { label: e.target.value })} />
          <input aria-label={`Step ${i + 1} when`} value={x.when} placeholder="A week before" disabled={disabled} onBlur={() => commit()} onChange={e => set(i, { when: e.target.value })} />
          <button type="button" className="st-x" aria-label={`Remove step ${i + 1}`} disabled={disabled || rows.length < 2}
            onClick={() => { const next = rows.filter((_, j) => j !== i); setRows(next); commit(next); }}>×</button>
        </div>
      ))}
      <div className="st-plan-foot">
        <button type="button" className="st-link" disabled={disabled} onClick={() => setRows(r => [...r, { pct: 0, label: '', when: '' }])}>+ Add a step</button>
        <small className={total === 100 ? '' : 'bad'}>{total === 100 ? 'Adds up to 100%' : `Adds up to ${total}%. Make it 100% to save.`}</small>
      </div>
    </div>
  );
};

// GST, UPI, the usual payment plan and how long quotes stay valid.
const MoneyGroup: React.FC<{ api: SettingsApi }> = ({ api }) => {
  const { dc, docs, docsReady, saveDc, saveDoc } = api;
  const rate = Number(dc?.gst_rate ?? 18);
  const old = isOldSlab(rate);

  return (
    <Panel id="money" title="Money & tax" sub="What goes on bills and how people pay.">
      <div className="st-grid">
        <label className="st-field">
          <span>GST on bills</span>
          <select value={String(rate)} onChange={e => saveDc('GST on bills', 'gst_rate', Number(e.target.value))}>
            <option value="0">Not GST-registered (bill of supply)</option>
            {GST_SLABS.filter(Boolean).map(n => <option key={n} value={n}>{n}%</option>)}
            {old && <option value={rate}>{rate}% (no longer a GST slab)</option>}
          </select>
          <small className={old ? 'warn' : ''}>
            {old ? `Saved as ${rate}%, which is no longer a slab. Pick 5% or 18% with your CA.` : rate === 0 ? 'Bills print as "Bill of supply", with no tax lines' : 'Added to quotations and invoices'}
          </small>
        </label>
        <Field label="UPI ID for QR codes" value={docs.upi_id} placeholder="name@bank" disabled={!docsReady} warn={!docs.upi_id}
          hint={docs.upi_id ? 'Shown as a QR on quotes, invoices and bills' : 'Add it so customers can scan and pay'}
          check={v => (v.trim() && !UPI_RE.test(v.trim()) ? 'Looks like name@bank' : null)}
          onSave={v => saveDoc('UPI ID', 'upi_id', v.trim())} />
        <Field label="Quotes are valid for (days)" value={String(docs.quote_valid_days)} inputMode="numeric" disabled={!docsReady}
          check={v => (/^\d+$/.test(v.trim()) && Number(v) > 0 ? null : 'Type a number of days')}
          onSave={v => saveDoc('Quote validity', 'quote_valid_days', Number(v))} />
      </div>
      <div className="st-block">
        <span className="st-block-label">Usual payment plan</span>
        <small className="st-block-note">Percent · step · when. Printed on quotations.</small>
        <PlanEditor steps={docs.schedule} disabled={!docsReady} onSave={s => saveDoc('Payment plan', 'schedule', s)} />
      </div>
      <div className="st-rows">
        <Soon label="GST on sweets" note="Sweets and catering can differ" />
      </div>
      {!docsReady && <Row label="UPI, plan and validity" note="Run the document settings database update to change these." warn />}
    </Panel>
  );
};

export default MoneyGroup;
