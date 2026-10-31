import React from 'react';
import { DOC_SETTINGS_MIGRATION_FILE } from '../hooks/useSchemaStatus';
import { ACCENTS, DocSettings } from '../lib/docs/settings';
import { Field, Notice, Panel, Row, Soon, ToggleRow } from './settings/SettingsUi';
import { SettingsApi } from './settings/useSettingsSave';

type Flag = 'invoice_payments' | 'invoice_qr' | 'invoice_menu' | 'quote_qr' | 'slip_stub';
const FLAGS: { key: Flag; label: string; note?: string }[] = [
  { key: 'invoice_payments', label: 'Invoice: list every payment' },
  { key: 'invoice_qr', label: 'Invoice: UPI QR for the balance' },
  { key: 'invoice_menu', label: 'Invoice: menu as the last page' },
  { key: 'quote_qr', label: 'UPI QR on quotes', note: 'For the advance' },
  { key: 'slip_stub', label: 'Pre-booking slip: counter stub', note: 'Tear-off with Packed and Given boxes' },
];

const lines = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean);
const count = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// Settings → Documents: colour, what prints on quotations, invoices, slips and sweets bills.
const DocSettingsCard: React.FC<{ api: SettingsApi }> = ({ api }) => {
  const { docs, docsReady, saveDoc } = api;
  const off = !docsReady;
  const save = <K extends keyof DocSettings>(label: string, key: K) => (v: DocSettings[K]) => saveDoc(label, key, v);

  return (
    <Panel id="documents" title="Documents" sub="How quotations, invoices and bills look.">
      {off && <Notice>Run <code>{DOC_SETTINGS_MIGRATION_FILE}</code> in Supabase → SQL Editor to change these. Documents use the values shown until then.</Notice>}
      <div className="st-rows">
        <Row label="Colour" note="Line at the top of every PDF">
          <span className="st-swatches" role="radiogroup" aria-label="Colour">
            {ACCENTS.map(a => (
              <button key={a.color} type="button" role="radio" aria-checked={docs.accent === a.color} aria-label={a.name} title={a.name} disabled={off}
                className="st-swatch" style={{ background: a.color }} onClick={() => saveDoc('Colour', 'accent', a.color)} />
            ))}
          </span>
        </Row>
        {FLAGS.map(f => <ToggleRow key={f.key} label={f.label} note={f.note} on={docs[f.key]} disabled={off} onChange={save(f.label, f.key)} />)}
        <Soon label="Menu layout" note="Courses side by side" />
        <Soon label="Dish prices on quotes" note="Show or hide each dish's price" />
      </div>
      <div className="st-grid">
        <Field label="Sweets bill footer" value={docs.bill_footer} placeholder="Thank you! Visit again." disabled={off} onSave={v => saveDoc('Sweets bill footer', 'bill_footer', v.trim())} />
        <Field label="Bank details for transfers" value={docs.bank} placeholder="Bank · A/c 0000 · IFSC XXXX0000" disabled={off} warn={!docs.bank}
          hint={docs.bank ? 'Printed on invoices under the QR' : 'Printed on invoices once added'} onSave={v => saveDoc('Bank details', 'bank', v.trim())} />
        <Field full multiline label="Terms on quotes" value={docs.terms.join('\n')} disabled={off} hint={`One per line · ${count(docs.terms.length, 'line')} today`}
          onSave={v => saveDoc('Terms on quotes', 'terms', lines(v))} />
        <Field full multiline label="Charged extra on request" value={docs.extras.join('\n')} disabled={off} hint="One per line · shown under the price, e.g. live counters"
          onSave={v => saveDoc('Charged extra on request', 'extras', lines(v))} />
      </div>
    </Panel>
  );
};

export default DocSettingsCard;
