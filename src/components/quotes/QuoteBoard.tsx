import React, { useMemo, useState } from 'react';
import type { Quotation } from '../../hooks/useQuotations';
import { buildBoard, boardSections, tabCounts, headline, matchesSearch, QUOTE_TABS, QuoteTab, BoardRow } from '../../lib/quoteBoard';
import { todayIST } from '../../lib/ist';
import Modal from '../ui/Modal';
import QuoteTidyBanner from '../catering/QuoteTidyBanner';
import QuoteRow from './QuoteRow';
import QuoteSidePanel from './QuoteSidePanel';
import { QuoteActions } from './QuoteMenu';
import { useMedia, NARROW } from './bits';

interface Props {
  quotes: Quotation[];
  loading: boolean;
  invoiced: Set<string>;
  a: QuoteActions;
  onNew: () => void;
}

const Skeleton = () => (
  <div className="q-card q-skel" aria-busy="true" aria-label="Loading quotations">
    {[0, 1, 2].map(i => <div key={i} className="q-row"><i className="sq" /><span className="q-txt"><i className="l1" /><i className="l2" /></span><i className="l3" /></div>)}
  </div>
);

// Quotations list: follow-ups first, tabs, search and the selected quote beside it.
const QuoteBoard: React.FC<Props> = ({ quotes, loading, invoiced, a, onNew }) => {
  const today = todayIST();
  const narrow = useMedia(NARROW);
  const [tab, setTab] = useState<QuoteTab>('todo');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [only, setOnly] = useState<Set<string> | null>(null);

  const all = useMemo(() => buildBoard(quotes, today, invoiced), [quotes, today, invoiced]);
  const rows = all.filter(r => matchesSearch(r, search) && (!only || r.group.options.some(o => only.has(o.id))));
  const counts = tabCounts(rows);
  const sections = boardSections(rows, only ? 'all' : tab);
  const visible = sections.flatMap(s => s.rows);
  const selected = visible.find(r => r.key === picked) ?? (narrow ? undefined : visible[0]);

  const select = (r: BoardRow) => { setPicked(r.key); if (narrow) setSheet(true); };
  const fold = (key: string) => setFolded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const empty = !loading && !quotes.length ? (
    <div className="q-empty">
      <b>No quotations yet</b>
      <span>Make one from a booking, or start a new event.</span>
      <button type="button" className="ui-btn" onClick={onNew}>+ New quotation</button>
    </div>
  ) : search.trim() && !rows.length ? (
    <div className="q-empty">
      <b>Nothing matches "{search.trim()}"</b>
      <span>Search looks at names, phones and numbers.</span>
      <button type="button" className="ui-btn" onClick={() => setSearch('')}>Clear search</button>
    </div>
  ) : !sections.length ? (
    <div className="q-empty">
      <b>{tab === 'todo' ? 'Nothing needs you' : `No ${QUOTE_TABS.find(t => t.id === tab)!.label.toLowerCase()} quotes`}</b>
      {tab === 'todo' && <span>All quotes sent and answered.</span>}
    </div>
  ) : null;

  return (
    <div className="q-page">
      <div className="q-head">
        <div>
          <h1>Quotations</h1>
          <span className="q-sub">{headline(all)}</span>
        </div>
        <div className="q-head-acts">
          <label className="q-search">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, phone or QTN number" aria-label="Search quotations" />
          </label>
          <button type="button" className="ui-btn primary q-new" onClick={onNew}>+ New<span className="q-dk"> quotation</span></button>
        </div>
      </div>

      <QuoteTidyBanner quotations={quotes} onSee={ids => setOnly(new Set(ids))} />
      {only && (
        <div className="q-only">
          <span>Showing the quotes that don't match their booking.</span>
          <button type="button" className="ui-btn" onClick={() => setOnly(null)}>Show all</button>
        </div>
      )}

      <div className="q-layout">
        <section className="q-main" aria-label="Quotation list">
          {!only && (
            <div role="tablist" aria-label="Show" className="q-tabs">
              {QUOTE_TABS.map(t => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                  <span className="q-dk">{t.label}</span><span className="q-ph">{t.short}</span> <span className="n">{counts[t.id]}</span>
                </button>
              ))}
            </div>
          )}
          {loading ? <Skeleton /> : empty ?? (
            <div className="q-sections">
              {sections.map(s => (
                <div key={s.id} className="q-card">
                  <div className="q-sec-title">{s.title} · {s.rows.length}</div>
                  {s.rows.map(r => (
                    <QuoteRow key={r.key} r={r} a={a} selected={!narrow && selected?.key === r.key}
                      folded={folded.has(r.key)} onSelect={select} onFold={fold} />
                  ))}
                </div>
              ))}
            </div>
          )}
          <span className="q-note q-dk">Quotes with options show as one row with each option under it. Send opens WhatsApp with the saved number; on a computer the PDF is saved to attach, on a phone it goes straight in.</span>
        </section>
        {!narrow && selected && (
          <aside className="q-aside" aria-label="Selected quotation"><QuoteSidePanel r={selected} a={a} today={today} /></aside>
        )}
      </div>

      {narrow && sheet && selected && (
        <Modal title={`${selected.head.quotation_number} · ${selected.head.customer?.name ?? ''}`} variant="panel" onClose={() => setSheet(false)}>
          <QuoteSidePanel r={selected} a={{ ...a, open: q => { setSheet(false); a.open(q); } }} today={today} />
        </Modal>
      )}
    </div>
  );
};

export default QuoteBoard;
