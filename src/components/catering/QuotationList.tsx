import React, { useMemo, useState } from 'react';
import { Quotation } from '../../hooks/useQuotations';
import { formatDateIST } from '../../lib/ist';
import { optionTitle, totalText, plateText } from '../../lib/quoteOptions';
import { groupQuotes, groupTotal, groupStatus, acceptedOf, QuoteGroup } from '../../lib/quoteGroups';
import { dishCount } from '../../lib/quoteChoices';
import { STATUSES, STATUS_COLORS, Actions, StatusSelect, RowActions, actionBtn, eventLabel, typeLabel, panel, cell, sub, optChip } from './QuotationRowParts';

type Filter = 'all' | typeof STATUSES[number];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props extends Actions {
  quotations: Quotation[];
  onStatus: (q: Quotation, status: string) => void;
}

// Shown group: every option for the summary, only the options that pass the status filter as rows.
interface Shown extends QuoteGroup { rows: Quotation[] }

// Master line of an enquiry with options: one PDF / share of all options, and open.
const GroupActions: React.FC<Actions & { g: QuoteGroup; big?: boolean }> = ({ g, big, onPdf, onShare, onEdit }) => {
  const first = acceptedOf(g) ?? g.options[0];
  const labels = g.options.map(o => o.option_label).join(' + ');
  return (
    <>
      <button onClick={() => onShare(first, g.options)} style={actionBtn('#1DA851', true, big)} title={`One PDF with options ${labels}, on WhatsApp`}>📤 Share all</button>
      <button onClick={() => onPdf(first, g.options)} style={actionBtn('#378ADD', false, big)} title={`One PDF with options ${labels}`}>⬇ PDF · {labels}</button>
      <button onClick={() => onEdit(first)} style={actionBtn('#444', false, big)}>✏ Open</button>
    </>
  );
};

const optionName = (q: Quotation) => (
  <span style={{ ...optChip, marginTop: 0, fontSize: 11.5 }}>{optionTitle(q)}</span>
);

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

  // A search hit on one option brings its whole enquiry along.
  const shown = useMemo<Shown[]>(() => {
    const hit = new Set(searched.map(q => q.option_group || q.id));
    return groupQuotes(quotations.filter(q => hit.has(q.option_group || q.id)))
      .map(g => ({ ...g, rows: filter === 'all' ? g.options : g.options.filter(q => q.status === filter) }))
      .filter(g => g.rows.length);
  }, [quotations, searched, filter]);
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

  const tone = (g: QuoteGroup) => { const s = groupStatus(g); return <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[s.tone] }}>{s.text}</span>; };

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
                  {shown.map(g => (g.grouped ? (
                    <React.Fragment key={g.key}>
                      <tr style={{ background: '#FFFAF4', borderTop: '0.5px solid #F0E2D0' }}>
                        <td style={{ ...cell, borderLeft: '3px solid #E8750A' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8750A' }}>{g.options[0].quotation_number}</div>
                          <div style={{ ...optChip, background: '#E8750A', color: '#fff' }}>{g.options.length} options</div>
                          <div style={sub}>{formatDateIST(g.options[0].issue_date, 'dd-MM-yyyy')}</div>
                        </td>
                        <td style={{ ...cell, fontSize: 13, fontWeight: 600, whiteSpace: 'normal' }}>{g.options[0].customer?.name || '—'}</td>
                        <td style={{ ...cell, whiteSpace: 'normal' }}><div style={{ fontSize: 12, color: '#666' }}>{eventLabel(g.options[0])}</div></td>
                        <td style={{ ...cell, fontSize: 13, fontWeight: 700 }}>{groupTotal(g)}</td>
                        <td style={{ ...cell, whiteSpace: 'normal' }}>{tone(g)}</td>
                        <td style={{ ...cell, whiteSpace: 'normal' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minWidth: 150 }}><GroupActions g={g} {...actions} /></div>
                        </td>
                      </tr>
                      {g.rows.map(q => (
                        <tr key={q.id} style={{ borderTop: '0.5px dashed #F0E2D0' }}>
                          <td style={{ ...cell, borderLeft: '3px solid #F6C89A', paddingLeft: 22 }}>
                            {optionName(q)}
                            <div style={sub}>{q.quotation_number}</div>
                          </td>
                          <td style={{ ...cell, fontSize: 12, color: '#666' }}>{q.is_multi_day ? '' : `${dishCount(q.items)} dishes`}</td>
                          <td style={cell}><div style={sub}>{typeLabel(q)}</div></td>
                          <td style={{ ...cell, fontSize: 13, fontWeight: 600 }}>{totalText(q)}</td>
                          <td style={cell}><StatusSelect q={q} onStatus={onStatus} /></td>
                          <td style={{ ...cell, whiteSpace: 'normal' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minWidth: 150 }}><RowActions q={q} {...actions} /></div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ) : g.rows.map(q => (
                    <tr key={q.id} style={{ borderTop: '0.5px solid #F0F0EA' }}>
                      <td style={cell}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#E8750A' }}>{q.quotation_number}</div>
                        <div style={sub}>{formatDateIST(q.issue_date, 'dd-MM-yyyy')}</div>
                      </td>
                      <td style={{ ...cell, fontSize: 13, whiteSpace: 'normal' }}>{q.customer?.name || '—'}</td>
                      <td style={{ ...cell, whiteSpace: 'normal' }}>
                        <div style={{ fontSize: 12, color: '#666' }}>{eventLabel(q)}</div>
                        <div style={sub}>{typeLabel(q)}</div>
                      </td>
                      <td style={{ ...cell, fontSize: 13, fontWeight: 600 }}>{totalText(q)}</td>
                      <td style={cell}><StatusSelect q={q} onStatus={onStatus} /></td>
                      <td style={{ ...cell, whiteSpace: 'normal' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minWidth: 150 }}><RowActions q={q} {...actions} /></div>
                      </td>
                    </tr>
                  ))))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="only-mobile">
            <div className="list-cards">
              {shown.map(g => {
                const head = g.options[0];
                return (
                  <div key={g.key} className="list-card" style={g.grouped ? { borderLeft: '3px solid #E8750A' } : undefined}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#E8750A' }}>{head.quotation_number}
                        {g.grouped && <span style={{ ...optChip, marginLeft: 6, background: '#E8750A', color: '#fff' }}>{g.options.length} options</span>}</span>
                      {g.grouped ? tone(g) : <StatusSelect q={head} onStatus={onStatus} />}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{head.customer?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{eventLabel(head)}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{groupTotal(g)}</span>
                      {!g.grouped && <span style={{ fontSize: 12, color: '#888880' }}>{typeLabel(head)}</span>}
                    </div>
                    <div className="list-card-actions">{g.grouped ? <GroupActions g={g} big {...actions} /> : <RowActions q={head} big {...actions} />}</div>
                    {g.grouped && g.rows.map(q => (
                      <div key={q.id} style={{ marginTop: 10, padding: '8px 10px', border: '0.5px solid #F0E2D0', borderRadius: 8, background: '#FFFCF8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{optionName(q)} <span style={{ fontSize: 11, color: '#888880' }}>{q.quotation_number}</span></span>
                          <StatusSelect q={q} onStatus={onStatus} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: '#666' }}>
                          <b style={{ fontSize: 14, color: '#1A1A18' }}>{totalText(q)}</b>
                          <span>{q.is_multi_day ? typeLabel(q) : `${plateText(q)}/plate · ${dishCount(q.items)} dishes`}</span>
                        </div>
                        <div className="list-card-actions"><RowActions q={q} big {...actions} /></div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default QuotationList;
