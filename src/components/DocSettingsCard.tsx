import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDocSettings, useSaveDocSettings } from '../hooks/useDocSettings';
import { DOC_SETTINGS_MIGRATION_FILE } from '../hooks/useSchemaStatus';
import { ACCENTS, DocSettings, PayStep } from '../lib/docs/settings';

const card: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#666660', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #E5E5E0', borderRadius: 7, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };
const title: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#1A237E' };

const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void; children: React.ReactNode }> = ({ on, set, children }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32, fontSize: 13, cursor: 'pointer' }}>
    <input type="checkbox" checked={on} onChange={e => set(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1A237E' }} />{children}
  </label>
);

// Owner-editable details and switches for quotations, invoices, slips and bills.
const DocSettingsCard: React.FC = () => {
  const saved = useDocSettings();
  const { ready, saving, save } = useSaveDocSettings();
  const [s, setS] = useState<DocSettings>(saved);
  useEffect(() => setS(saved), [saved]);
  const set = <K extends keyof DocSettings>(k: K, v: DocSettings[K]) => setS(p => ({ ...p, [k]: v }));
  const setStep = (i: number, patch: Partial<PayStep>) => set('schedule', s.schedule.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pctTotal = s.schedule.reduce((t, x) => t + (Number(x.pct) || 0), 0);

  const onSave = async () => {
    if (pctTotal !== 100) { toast.error(`Payment schedule adds up to ${pctTotal}%, not 100%`); return; }
    const clean = (l: string[]) => l.map(x => x.trim()).filter(Boolean);
    try { await save({ ...s, schedule: s.schedule.filter(x => x.pct > 0), extras: clean(s.extras), terms: clean(s.terms) }); toast.success('Document settings saved'); }
    catch (e: any) { toast.error(e?.message || 'Could not save'); }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 15, fontWeight: 700 }}>Documents</div><div style={{ fontSize: 12, color: '#888880' }}>Quotations, invoices, pre-booking slips and bills</div></div>
        <button type="button" onClick={onSave} disabled={!ready || saving}
          style={{ background: '#1A237E', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: ready ? 1 : 0.5 }}>
          {saving ? 'Saving…' : 'Save document settings'}
        </button>
      </div>
      {!ready && (
        <div role="status" style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#6D4C00' }}>
          Run <code>{DOC_SETTINGS_MIGRATION_FILE}</code> in Supabase → SQL Editor to save these. Documents use the defaults shown until then.
        </div>
      )}
      <div className="g2" style={{ alignItems: 'start' }}>
        <div style={card}>
          <span style={title}>Look &amp; business details</span>
          <div><span style={lbl}>Accent colour</span>
            <div style={{ display: 'flex', gap: 10 }}>{ACCENTS.map(a => (
              <button key={a.color} type="button" aria-label={a.name} aria-pressed={s.accent === a.color} onClick={() => set('accent', a.color)}
                style={{ width: 36, height: 36, borderRadius: 18, background: a.color, cursor: 'pointer', border: s.accent === a.color ? '3px solid #1A237E' : '3px solid #fff', boxShadow: '0 0 0 1px #D0D0CC' }} />
            ))}</div></div>
          <label><span style={lbl}>Shop address</span><input style={inp} value={s.address} onChange={e => set('address', e.target.value)} placeholder="Shop no., area, Ahmedabad" /></label>
          <div className="g2" style={{ gap: 10, margin: 0 }}>
            <label><span style={lbl}>UPI ID (for the QR)</span><input style={inp} value={s.upi_id} onChange={e => set('upi_id', e.target.value)} placeholder="name@bank" /></label>
            <label><span style={lbl}>Contact person</span><input style={inp} value={s.contact_name} onChange={e => set('contact_name', e.target.value)} /></label>
          </div>
          <label><span style={lbl}>Bank details (printed under the QR)</span><input style={inp} value={s.bank} onChange={e => set('bank', e.target.value)} placeholder="Bank · A/c 0000 · IFSC XXXX0000" /></label>
          <span style={{ fontSize: 11, color: '#888880' }}>GSTIN comes from Business Information above.</span>
        </div>

        <div style={card}>
          <span style={title}>Quotation</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}><span style={{ flex: 1 }}>Valid for</span>
            <input type="number" min={1} style={{ ...inp, width: 80 }} value={s.quote_valid_days} onChange={e => set('quote_valid_days', Math.max(1, Number(e.target.value) || 1))} /> days</label>
          <div><span style={lbl}>Payment schedule ({pctTotal}%)</span>
            {s.schedule.map((x, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) minmax(0,1.4fr) 30px', gap: 6, marginBottom: 6 }}>
                <input style={inp} inputMode="numeric" aria-label={`Step ${i + 1} percent`} value={x.pct} onChange={e => setStep(i, { pct: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
                <input style={inp} aria-label={`Step ${i + 1} name`} value={x.label} onChange={e => setStep(i, { label: e.target.value })} />
                <input style={inp} aria-label={`Step ${i + 1} when`} value={x.when} onChange={e => setStep(i, { when: e.target.value })} />
                <button type="button" aria-label={`Remove step ${i + 1}`} onClick={() => set('schedule', s.schedule.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
              </div>
            ))}
            <button type="button" onClick={() => set('schedule', [...s.schedule, { pct: 0, label: '', when: '' }])} style={{ border: '0.5px dashed #C5CAE9', background: '#fff', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>+ Add step</button>
          </div>
          <label><span style={lbl}>On request, charged extra (one per line)</span><textarea rows={3} style={inp} value={s.extras.join('\n')} onChange={e => set('extras', e.target.value.split('\n'))} /></label>
          <label><span style={lbl}>Terms (one per line)</span><textarea rows={4} style={inp} value={s.terms.join('\n')} onChange={e => set('terms', e.target.value.split('\n'))} /></label>
          <Toggle on={s.quote_qr} set={v => set('quote_qr', v)}>UPI QR to pay the booking amount</Toggle>
        </div>

        <div style={card}>
          <span style={title}>Invoice</span>
          <Toggle on={s.invoice_payments} set={v => set('invoice_payments', v)}>List every payment received</Toggle>
          <Toggle on={s.invoice_qr} set={v => set('invoice_qr', v)}>UPI QR for the balance</Toggle>
          <Toggle on={s.invoice_menu} set={v => set('invoice_menu', v)}>Add the menu served as the last page</Toggle>
        </div>

        <div style={card}>
          <span style={title}>Sweets</span>
          <Toggle on={s.slip_stub} set={v => set('slip_stub', v)}>Pre-booking slip with a tear-off counter stub</Toggle>
          <label><span style={lbl}>Bill footer line</span><input style={inp} value={s.bill_footer} onChange={e => set('bill_footer', e.target.value)} /></label>
        </div>
      </div>
    </div>
  );
};

export default DocSettingsCard;
