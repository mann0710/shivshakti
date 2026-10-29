import React, { useMemo, useState } from 'react';
import { Quotation } from '../../hooks/useQuotations';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { quotationDates } from '../../lib/quotationShare';

const STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const;
type Filter = 'all' | typeof STATUSES[number];

const STATUS_COLORS: Record<string, string> = {
  draft: '#888880', sent: '#378ADD', accepted: '#639922', rejected: '#CC4444',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Actions {
  onPdf: (q: Quotation) => void;
  onShare: (q: Quotation) => void;
  onEdit: (q: Quotation) => void;
  onClone: (q: Quotation) => void;
  onDelete: (q: Quotation) => void;
}

interface Props extends Actions {
  quotations: Quotation[];
  onStatus: (q: Quotation, status: string) => void;
}

const StatusSelect: React.FC<{ q: Quotation; onStatus: Props['onStatus'] }> = ({ q, onStatus }) => (
  <select value={q.status} onChange={e => onStatus(q, e.target.value)} aria-label="Status"
    style={{ border: '0.5px solid #E5E5E0', borderRadius: 6, background: '#fff', fontSize: 12, fontWeight: 600, color: STATUS_COLORS[q.status] || '#888880', cursor: 'pointer', padding: '3px 6px' }}>
    {STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
  </select>
);

const RowActions: React.FC<Actions & { q: Quotation; big?: boolean }> = ({ q, big, onPdf, onShare, onEdit, onClone, onDelete }) => {
  const btn = (color: string, filled = false): React.CSSProperties => ({
    background: filled ? color : '#fff', color: filled ? '#fff' : color,
    border: `1px solid ${filled ? color : '#E5E5E0'}`, borderRadius: big ? 8 : 5,
    padding: big ? '6px 12px' : '3px 8px', fontSize: big ? 13 : 11, fontWeight: filled ? 600 : 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
  });
  return (
    <>
      <button onClick={() => onShare(q)} style={btn('#1DA851', true)} title="Send PDF on WhatsApp">📤 Share</button>
      <button onClick={() => onPdf(q)} style={btn('#378ADD')}>⬇ PDF</button>
      <button onClick={() => onEdit(q)} style={btn('#444')}>✏ Edit</button>
      <button onClick={() => onClone(q)} style={btn('#0F6E56')}>⧉ Clone</button>
      <button onClick={() => onDelete(q)} style={btn('#CC4444')}>🗑 Delete</button>
    </>
  );
};

const eventLabel = (q: Quotation) => {
  if (!q.booking) return '—';
  const dates = quotationDates(q);
  return dates ? `${q.booking.event_type} · ${dates}` : q.booking.event_type;
};

const typeLabel = (q: Quotation) => q.is_multi_day
  ? <span style={{ background: '#E6F1FB', color: '#185FA5', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>Multi-day ({q.event_days?.length || 0}d)</span>
  : q.per_plate_amount > 0 ? `${inr(q.per_plate_amount)}/plate` : '—';

const QuotationList: React.FC<Props> = ({ quotations, onStatus, ...actions }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Matches quotation number, customer name or phone digits.
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    if (!term) return quotations;
    return quotations.filter(q =>
      (q.quotation_number || '').toLowerCase().includes(term)
      || String(q.customer?.name || '').toLowerCase().includes(term)
      || (digits.length >= 3 && String(q.customer?.phone || '').replace(/\D/g, '').includes(digits)));
  }, [quotations, search]);

  const shown = filter === 'all' ? searched : searched.filter(q => q.status === filter);
  const count = (f: Filter) => (f === 'all' ? searched.length : searched.filter(q => q.status === f).length);

  if (quotations.length === 0) {
    return (
      <div style={{ ...panel, padding: '48px 24px', textAlign: 'center', color: '#AAAAAA' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>No quotations yet</div>
        <div style={{ fontSize: 12 }}>Create your first quotation using the button above</div>
      </div>
    );
  }

  return (
    <div>
      <input type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by quotation #, customer or phone…"
        style={{ width: '100%', maxWidth: 420, border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box', marginBottom: 10, background: '#fff' }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', ...STATUSES] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '0.5px solid',
              background: filter === f ? '#E8750A' : 'transparent', color: filter === f ? '#fff' : '#666660',
              borderColor: filter === f ? '#E8750A' : '#D0D0CC' }}>
            {cap(f)} ({count(f)})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ ...panel, padding: '32px 16px', textAlign: 'center', color: '#888880', fontSize: 13 }}>No quotations match</div>
      ) : (
        <>
          <div className="only-desktop" style={{ ...panel, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                    {['Quotation #', 'Customer', 'Event', 'Total', 'Status', ''].map(h => (
                      <th key={h} style={{ ...cell, fontSize: 11, fontWeight: 600, color: '#888880', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((q, i) => (
                    <tr key={q.id} style={{ borderBottom: i < shown.length - 1 ? '0.5px solid #F0F0EA' : 'none' }}>
                      <td style={cell}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#E8750A' }}>{q.quotation_number}</div>
                        <div style={sub}>{formatDateIST(q.issue_date, 'dd-MM-yyyy')}</div>
                      </td>
                      <td style={{ ...cell, fontSize: 13, whiteSpace: 'normal' }}>{q.customer?.name || '—'}</td>
                      <td style={{ ...cell, whiteSpace: 'normal' }}>
                        <div style={{ fontSize: 12, color: '#666' }}>{eventLabel(q)}</div>
                        <div style={sub}>{typeLabel(q)}</div>
                      </td>
                      <td style={{ ...cell, fontSize: 13, fontWeight: 600 }}>{inr(q.total_amount || 0)}</td>
                      <td style={cell}><StatusSelect q={q} onStatus={onStatus} /></td>
                      <td style={{ ...cell, whiteSpace: 'normal' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minWidth: 150 }}><RowActions q={q} {...actions} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="only-mobile">
            <div className="list-cards">
              {shown.map(q => (
                <div key={q.id} className="list-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#E8750A' }}>{q.quotation_number}</span>
                    <StatusSelect q={q} onStatus={onStatus} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{q.customer?.name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{eventLabel(q)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{inr(q.total_amount || 0)}</span>
                    <span style={{ fontSize: 12, color: '#888880' }}>{typeLabel(q)}</span>
                  </div>
                  <div className="list-card-actions"><RowActions q={q} big {...actions} /></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const panel: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0' };
const cell: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' };
const sub: React.CSSProperties = { fontSize: 11, color: '#888880', marginTop: 2 };

export default QuotationList;
