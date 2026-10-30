import React from 'react';
import { Quotation } from '../../hooks/useQuotations';
import { optionTitle, plateText, totalText, statusText } from '../../lib/quoteOptions';
import { ORANGE } from './CustomerUi';

interface Props {
  current?: Quotation;
  siblings: Quotation[];
  enabled: boolean;     // quote-options migration has been run
  dirty: boolean;
  name: string;
  onName: (v: string) => void;
  onSwitch: (q: Quotation) => void;
  onAdd: () => void;
  onAccept: (q: Quotation) => void;
  busy: boolean;
}

// Tabs for options A / B / C of one enquiry, the option's name, and "+ Add option".
const QuotationOptionsBar: React.FC<Props> = ({ current, siblings, enabled, dirty, name, onName, onSwitch, onAdd, onAccept, busy }) => {
  if (!enabled) return null;
  const grouped = siblings.length > 1;
  const why = !current ? 'Save this quotation first' : dirty ? 'Save your changes first' : '';

  return (
    <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap', borderBottom: '0.5px solid #E5E5E0' }}>
        {grouped && siblings.map(o => {
          const on = o.id === current?.id;
          return (
            <button key={o.id} type="button" onClick={() => !on && onSwitch(o)} aria-pressed={on}
              style={{ textAlign: 'left', padding: '8px 14px', border: on ? `1.5px solid ${ORANGE}` : '0.5px solid #E5E5E0', borderBottom: 'none', borderRadius: '10px 10px 0 0', background: on ? '#fff' : '#FAFAF7', cursor: on ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: on ? '#A84F00' : '#1A1A18' }}>{optionTitle(o)}</span>
              <span style={{ fontSize: 11.5, color: '#6B6B66' }}>{o.is_multi_day ? totalText(o) : `${plateText(o)} / plate`} · {statusText(o)}</span>
            </button>
          );
        })}
        <button type="button" onClick={onAdd} disabled={!!why || busy} title={why || 'Copy this quotation as another option with its own menu and price'}
          style={{ height: 36, marginBottom: 6, padding: '0 14px', border: '0.5px dashed #C9C9C2', borderRadius: 8, background: 'transparent', fontSize: 12.5, color: why ? '#AAAAAA' : '#555550', cursor: why ? 'not-allowed' : 'pointer' }}>
          + Add option{grouped ? '' : ' (A / B)'}
        </button>
        {current && current.status !== 'accepted' && (
          <button type="button" onClick={() => onAccept(current)} disabled={dirty}
            title={dirty ? 'Save your changes first' : 'Record which option and dishes the customer chose'}
            style={{ height: 36, marginBottom: 6, padding: '0 14px', border: '0.5px solid #9CC27A', borderRadius: 8, background: '#F4F9EE', color: '#2F5A0E', fontSize: 12.5, fontWeight: 600, cursor: dirty ? 'not-allowed' : 'pointer', opacity: dirty ? 0.6 : 1 }}>
            Mark accepted…
          </button>
        )}
        {why && current === undefined && <span style={{ fontSize: 11.5, color: '#8A8A84', marginBottom: 14 }}>Save first to add options A / B</span>}
      </div>
      {grouped && current && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6B6B66' }}>
          Option {current.option_label} name
          <input value={name} onChange={e => onName(e.target.value)} placeholder="e.g. Classic, Premium"
            style={{ border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 10px', fontSize: 13, width: 200 }} />
          <span>The customer picks one option; each has its own menu and price.</span>
        </label>
      )}
    </div>
  );
};

export default QuotationOptionsBar;
