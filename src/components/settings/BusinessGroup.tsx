import React, { useState } from 'react';
import { SHOP } from '../../lib/shop';
import { cleanGstin, isValidGstin } from '../../lib/gst';
import { accentText } from '../../lib/docs/settings';
import { Field, Panel } from './SettingsUi';
import { SettingsApi } from './useSettingsSave';
import { useFssai } from './useFssai';
import { FssaiDialog } from './SettingsDialogs';

const CATERING_NAME = 'Shiv Shakti Catering Service';
const SWEETS_NAME = 'Shiv Shakti Sweets';

// Names, address, contact, GST number, logo and FSSAI certificate, with a live look at a quotation's header.
const BusinessGroup: React.FC<{ api: SettingsApi }> = ({ api }) => {
  const { dc, docs, docsReady, saveDc, saveDoc } = api;
  const fssai = useFssai();
  const [showFssai, setShowFssai] = useState(false);
  const gst = dc?.gst_number || '';
  const registered = Number(dc?.gst_rate ?? 18) > 0;

  return (
    <>
      <Panel id="business" title="Business" sub="Printed on every quotation, invoice and sweets bill.">
        <div className="st-grid">
          <Field label="Name on catering documents" value={CATERING_NAME} onSave={() => {}} disabled hint="Fixed for now · changing it here is coming soon" />
          <Field label="Name on sweets bills" value={SWEETS_NAME} onSave={() => {}} disabled hint="Fixed for now · changing it here is coming soon" />
          <Field label="Shop address" value={docs.address} placeholder="Shop, area, city" hint="Printed under the name" disabled={!docsReady}
            onSave={v => saveDoc('Shop address', 'address', v.trim())} />
          <Field label="Contact person" value={docs.contact_name} placeholder="Name" hint={`Printed at the end of quotations and invoices with +91 ${SHOP.phone}`} disabled={!docsReady}
            onSave={v => saveDoc('Contact person', 'contact_name', v.trim())} />
          <Field label="GST number" value={gst} placeholder="15 characters, starts with 24" warn={registered && !gst}
            hint={gst ? 'Printed on every document' : registered ? 'Needed for tax invoices' : 'Not needed while not GST-registered'}
            check={v => (v.trim() && !isValidGstin(v) ? 'GSTIN has 15 characters, like 24ABCDE1234F1Z5' : null)}
            onSave={v => saveDc('GST number', 'gst_number', v.trim() ? cleanGstin(v) : '')} />
          <Field label="FSSAI licence number" value="" placeholder="Coming soon" onSave={() => {}} disabled hint="Saving the licence number is coming soon" />
          <div className="st-tile">
            <img src="/logo.png" alt="" className="st-logo" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
            <span className="st-tile-main"><b>Logo</b><small>Shown top-left on documents</small></span>
            <span className="st-soon">Change: coming soon</span>
          </div>
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
          <img src="/logo.png" alt="" className="st-logo" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
          <span className="st-tile-main">
            <b>{CATERING_NAME}</b>
            <small>
              {[docs.address || null, `+91 ${SHOP.phone}`, SHOP.email].filter(Boolean).join(' · ')}
              {!docs.address && <em className="warn"> · Address missing</em>}
              {gst ? ` · GSTIN ${gst}` : registered && <em className="warn"> · GST number missing</em>}
            </small>
          </span>
          <span className="st-preview-doc"><b style={{ color: accentText(docs.accent) }}>QUOTATION</b><small>valid {docs.quote_valid_days} days</small></span>
        </div>
      </section>
      {showFssai && <FssaiDialog onClose={() => setShowFssai(false)} />}
    </>
  );
};

export default BusinessGroup;
