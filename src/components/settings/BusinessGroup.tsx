import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { SHOP } from '../../lib/shop';
import { cleanFssai, cleanGstin, fssaiProblem, isValidGstin } from '../../lib/gst';
import { accentText } from '../../lib/docs/settings';
import { Field, LinkBtn, Panel } from './SettingsUi';
import { SettingsApi } from './useSettingsSave';
import { uploadDocument, useFssai } from './useFssai';
import { FssaiDialog } from './SettingsDialogs';

const MAX_LOGO = 2 * 1024 * 1024;
const named = (v: string) => (v.trim() ? null : 'Type the name');

// Logo: shown top-left on documents and in the menu; "Use the original" goes back to the bundled one.
const LogoTile: React.FC<{ api: SettingsApi; logo: string }> = ({ api, logo }) => {
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error('Pick a PNG, JPG or WebP picture'); return; }
    if (file.size > MAX_LOGO) { toast.error('Pick a picture under 2 MB'); return; }
    setBusy(true);
    try { await api.saveDoc('Logo', 'logo_url', await uploadDocument('logo', file)); }
    catch (err: any) { toast.error(err?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };
  return (
    <div className="st-tile">
      <img src={logo} alt="" className="st-logo" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
      <span className="st-tile-main"><b>Logo</b><small>{api.docs.logo_url ? 'Your upload · shown top-left on documents' : 'Shown top-left on documents'}</small></span>
      {api.docs.logo_url && <LinkBtn onClick={() => api.saveDoc('Logo', 'logo_url', '')}>Use the original</LinkBtn>}
      <label className={`st-link st-upload${busy || !api.docsReady ? ' off' : ''}`}>
        {busy ? 'Uploading…' : 'Change'}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} disabled={busy || !api.docsReady} aria-label="Change the logo" />
      </label>
    </div>
  );
};

// Names, address, contact, GST and FSSAI numbers, logo and FSSAI certificate, with a live look at a quotation's header.
const BusinessGroup: React.FC<{ api: SettingsApi }> = ({ api }) => {
  const { dc, docs, docsReady, saveDc, saveDoc } = api;
  const fssai = useFssai();
  const [showFssai, setShowFssai] = useState(false);
  const gst = dc?.gst_number || '';
  const registered = Number(dc?.gst_rate ?? 18) > 0;
  const logo = docs.logo_url || '/logo.png';

  return (
    <>
      <Panel id="business" title="Business" sub="Printed on every quotation, invoice and sweets bill.">
        <div className="st-grid">
          <Field label="Name on catering documents" value={docs.catering_name} disabled={!docsReady} check={named} hint="Quotations, invoices and event menus"
            onSave={v => saveDoc('Catering name', 'catering_name', v.trim())} />
          <Field label="Name on sweets bills" value={docs.sweets_name} disabled={!docsReady} check={named} hint="Counter bills and pre-booking slips"
            onSave={v => saveDoc('Sweets name', 'sweets_name', v.trim())} />
          <Field label="Shop address" value={docs.address} placeholder="Shop, area, city" hint="Printed under the name" disabled={!docsReady}
            onSave={v => saveDoc('Shop address', 'address', v.trim())} />
          <Field label="Contact person" value={docs.contact_name} placeholder="Name" hint={`Printed at the end of quotations and invoices with +91 ${SHOP.phone}`} disabled={!docsReady}
            onSave={v => saveDoc('Contact person', 'contact_name', v.trim())} />
          <Field label="GST number" value={gst} placeholder="15 characters, starts with 24" warn={registered && !gst}
            hint={gst ? 'Printed on every document' : registered ? 'Needed for tax invoices' : 'Not needed while not GST-registered'}
            check={v => (v.trim() && !isValidGstin(v) ? 'GSTIN has 15 characters, like 24ABCDE1234F1Z5' : null)}
            onSave={v => saveDc('GST number', 'gst_number', v.trim() ? cleanGstin(v) : '')} />
          <Field label="FSSAI licence number" value={docs.fssai_number} placeholder="14 digits" inputMode="numeric" disabled={!docsReady} warn={!docs.fssai_number}
            hint={docs.fssai_number ? 'Printed on every bill and invoice' : 'Printed on every bill and invoice once added'}
            check={fssaiProblem} onSave={v => saveDoc('FSSAI number', 'fssai_number', cleanFssai(v))} />
          <LogoTile api={api} logo={logo} />
          <div className={`st-tile${fssai.url ? ' ok' : ' warn'}`}>
            <span className="st-tick" aria-hidden="true">{fssai.url ? '✓' : '!'}</span>
            <span className="st-tile-main"><b>FSSAI certificate</b><small>{fssai.url ? 'Uploaded' : 'Not uploaded yet'}</small></span>
            {fssai.url && <a className="st-link" href={fssai.url} target="_blank" rel="noopener noreferrer">View</a>}
            <button type="button" className="st-link" onClick={() => setShowFssai(true)}>{fssai.url ? 'Replace' : 'Upload'}</button>
          </div>
        </div>
      </Panel>

      <section className="st-panel" aria-label="How the top of a quotation looks">
        <span className="st-kicker">How the top of a quotation looks</span>
        <div className="st-preview" style={{ borderTopColor: docs.accent }}>
          <img src={logo} alt="" className="st-logo" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
          <span className="st-tile-main">
            <b>{docs.catering_name}</b>
            <small>
              {[docs.address || null, `+91 ${SHOP.phone}`, SHOP.email].filter(Boolean).join(' · ')}
              {!docs.address && <em className="warn"> · Address missing</em>}
              {gst ? ` · GSTIN ${gst}` : registered && <em className="warn"> · GST number missing</em>}
              {docs.fssai_number ? ` · FSSAI ${docs.fssai_number}` : <em className="warn"> · FSSAI number missing</em>}
            </small>
          </span>
          <span className="st-preview-doc"><b style={{ color: accentText(docs.accent) }}>QUOTATION</b><small>valid {docs.quote_valid_days} days</small></span>
        </div>
      </section>
      {showFssai && <FssaiDialog number={docs.fssai_number} onSaveNumber={docsReady ? v => saveDoc('FSSAI number', 'fssai_number', v) : undefined} onClose={() => setShowFssai(false)} />}
    </>
  );
};

export default BusinessGroup;
