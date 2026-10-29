import React, { useMemo, useState } from 'react';
import StatusPill from '../StatusPill';
import { Invoice } from '../../types';
import { formatDateIST } from '../../lib/ist';
import { ORANGE, card, inp, xBtn } from './InvoiceUi';

interface Props {
  invoices: Invoice[];
  isLoading: boolean;
  activeId?: string;
  onSelect: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
}

const matches = (inv: Invoice, term: string, digits: string) => {
  const c = inv.booking?.customer;
  return inv.invoice_number.toLowerCase().includes(term)
    || (c?.name ?? '').toLowerCase().includes(term)
    || (digits.length >= 3 && (c?.phone ?? '').replace(/\D/g, '').includes(digits));
};

// Searchable invoice list: a table on desktop, tappable cards on phones.
const InvoiceList: React.FC<Props> = ({ invoices, isLoading, activeId, onSelect, onDelete }) => {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? invoices.filter(inv => matches(inv, term, term.replace(/\D/g, ''))) : invoices;
  }, [invoices, q]);

  const balance = (inv: Invoice) => (
    <span style={{ color: inv.balance_due > 0 ? '#A32D2D' : '#3B6D11', fontWeight: 500 }}>₹{inv.balance_due.toLocaleString()}</span>
  );

  const body = isLoading ? <div style={emptyMsg}>Loading...</div>
    : shown.length === 0 ? <div style={emptyMsg}>{q ? `No invoices match "${q}".` : 'No invoices yet'}</div>
    : (
      <>
        <div className="table-wrap only-desktop">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#FAFAF8' }}>
              {['Invoice #', 'Customer', 'Amount', 'Balance', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {shown.map(inv => (
                <tr key={inv.id} onClick={() => onSelect(inv)}
                  style={{ borderTop: '0.5px solid #F0F0EC', cursor: 'pointer', background: activeId === inv.id ? '#FFFBF5' : 'transparent' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 500, color: ORANGE }}>{inv.invoice_number}</td>
                  <td style={{ padding: '9px 8px' }}>{inv.booking?.customer?.name}</td>
                  <td style={{ padding: '9px 8px', fontWeight: 500 }}>₹{inv.total_amount.toLocaleString()}</td>
                  <td style={{ padding: '9px 8px' }}>{balance(inv)}</td>
                  <td style={{ padding: '9px 12px' }}><StatusPill status={inv.status} /></td>
                  <td style={{ padding: '9px 8px' }}>
                    <button type="button" title="Delete invoice" aria-label="Delete invoice" style={{ ...xBtn, fontSize: 16, padding: '0 4px' }}
                      onClick={e => { e.stopPropagation(); onDelete(inv); }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="only-mobile">
          <div className="list-cards" style={{ padding: 10 }}>
            {shown.map(inv => {
              const active = activeId === inv.id;
              const b = inv.booking;
              return (
                <div key={inv.id} className="list-card" onClick={() => onSelect(inv)}
                  style={{ cursor: 'pointer', border: `0.5px solid ${active ? ORANGE : '#E5E5E0'}`, background: active ? '#FFFBF5' : '#FFFFFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: ORANGE }}>{inv.invoice_number}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b?.customer?.name}</div>
                      {b && <div style={{ fontSize: 11, color: '#888880' }}>{b.event_type} · {formatDateIST(b.event_date, 'dd-MM-yyyy')}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>₹{inv.total_amount.toLocaleString()}</div>
                      <div style={{ margin: '2px 0 4px' }}>{inv.balance_due > 0 ? <>Due {balance(inv)}</> : <span style={{ color: '#3B6D11', fontWeight: 500 }}>✓ Paid</span>}</div>
                      <StatusPill status={inv.status} />
                    </div>
                  </div>
                  <div className="list-card-actions" onClick={e => e.stopPropagation()}>
                    <button type="button" style={cardBtn} onClick={() => onSelect(inv)}>Open ›</button>
                    <button type="button" style={{ ...cardBtn, color: '#CC4444' }} onClick={() => onDelete(inv)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>All invoices</span>
        <input type="search" style={{ ...inp, flex: '1 1 160px', width: 'auto', minWidth: 0, fontSize: 12 }}
          placeholder="Search invoice #, name or phone" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {body}
    </div>
  );
};

const emptyMsg: React.CSSProperties = { padding: 30, textAlign: 'center', color: '#888880', fontSize: 13 };
const cardBtn: React.CSSProperties = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };

export default InvoiceList;
