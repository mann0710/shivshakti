import React, { useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { BookingView, onDay, PIPELINE, STAGE_STYLE } from '../../lib/bookingBoard';
import { STAGE_LABELS } from '../../lib/eventStage';
import { formatDateIST } from '../../lib/ist';
import { cap } from './BookingActions';
import BookingMenu, { BoardActions } from './BookingMenu';
import { StageChip, NextButton, detailLine } from './BookingBits';

interface Props { views: BookingView[]; actions: BoardActions; today: string; festivals?: Map<string, string[]> }

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const NO_FESTIVALS = new Map<string, string[]>();

// Calendar view: a month coloured by stage with festival days marked; picking a day shows its events, meals and next steps.
const BookingMonth: React.FC<Props> = ({ views, actions: a, today, festivals = NO_FESTIVALS }) => {
  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)));
  const [picked, setPicked] = useState(today);
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }), [month]);
  const live = views.filter(v => v.stage !== 'cancelled');
  const dayViews = onDay(live, picked);
  const dayFests = festivals.get(picked) ?? [];
  const inMonth = live.filter(v => v.start.slice(0, 7) === iso(month).slice(0, 7));
  const busy = new Set(days.filter(d => isSameMonth(d, month) && onDay(live, iso(d)).length).map(iso)).size;
  const waiting = inMonth.filter(v => v.next).length;
  const go = (n: number) => { const m = addMonths(month, n); setMonth(m); setPicked(iso(m)); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" aria-label="Previous month" onClick={() => go(-1)} style={navBtn}>‹</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, minWidth: 160, textAlign: 'center' }}>{format(month, 'MMMM yyyy')}</h2>
          <button type="button" aria-label="Next month" onClick={() => go(1)} style={navBtn}>›</button>
          <button type="button" onClick={() => { setMonth(startOfMonth(parseISO(today))); setPicked(today); }} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontSize: 13 }}>Today</button>
        </div>
        <div className="only-desktop" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: '#4A4A45' }}>
          {PIPELINE.map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_STYLE[s].dot }} />{STAGE_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="bk-cal">
        <div style={{ background: '#fff', border: '1px solid #E5E5E0', borderRadius: 14, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: '#FAFAF7', borderBottom: '1px solid #ECECE6' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d} style={{ padding: '8px 6px', fontSize: 12, fontWeight: 600, color: '#6B6B66', textAlign: 'center' }}>{d}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {days.map(d => {
              const key = iso(d);
              const evs = onDay(live, key);
              const sel = key === picked;
              const out = !isSameMonth(d, month);
              const fests = festivals.get(key) ?? [];
              return (
                <button key={key} type="button" className="bk-cell" onClick={() => setPicked(key)} aria-pressed={sel}
                  aria-label={`${format(d, 'd MMMM')}${fests.length ? `, ${fests.join(', ')}` : ''}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`}
                  style={{ background: sel ? '#FFF6EA' : out ? '#FAFAF7' : '#fff', boxShadow: sel ? 'inset 0 0 0 2px #E8750A' : 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: key === today ? '#E8750A' : out ? '#9A9A93' : '#1A1A18' }}>{format(d, 'd')}</span>
                  {fests.map(f => <span key={f} className="bk-chip bk-fest"><b>{f}</b> Sweets rush</span>)}
                  {evs.slice(0, 2).map(v => (
                    <span key={v.b.id} className="bk-chip" style={{ background: STAGE_STYLE[v.stage].bg, color: STAGE_STYLE[v.stage].fg }}>
                      <b>{v.b.customer?.name?.split(' ')[0] ?? '—'}</b> {v.b.event_type}
                    </span>
                  ))}
                  {evs.length > 2 && <span className="bk-chip" style={{ color: '#6B6B66' }}>+{evs.length - 2} more</span>}
                  <span className="bk-dots">{fests.length > 0 && <i className="fest" />}{evs.slice(0, 3).map(v => <i key={v.b.id} style={{ background: STAGE_STYLE[v.stage].dot }} />)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside aria-label="Selected day" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{formatDateIST(picked, 'EEE, d MMM')}</h3>
              <span style={{ fontSize: 12.5, color: '#6B6B66' }}>{dayViews.length ? `${dayViews.length} event${dayViews.length > 1 ? 's' : ''}` : 'Free'}</span>
            </div>
            {dayFests.length > 0 && <span className="bk-fest-note">{dayFests.join(', ')} · sweets rush on this day</span>}
            {dayViews.map(v => {
              const meals = (v.quote?.event_days ?? []).filter(d => d.date === picked).flatMap(d => d.meals ?? []);
              return (
                <div key={v.b.id} style={{ border: '1px solid #ECECE6', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <button type="button" onClick={() => a.open(v.b)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: '#1A1A18' }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{v.b.customer?.name ?? '—'}</span>
                      <span style={{ display: 'block', fontSize: 13, color: '#4A4A45' }}>{[v.b.event_type, detailLine(v)].filter(Boolean).join(' · ')}</span>
                    </button>
                    <StageChip v={v} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v.valueText}{v.quote?.food_type ? <span style={{ fontWeight: 400, color: '#4A4A45' }}> · {v.quote.food_type}</span> : null}</span>
                  {meals.map((m, i) => (
                    <span key={i} style={{ fontSize: 12.5, color: '#4A4A45', background: '#FAFAF7', borderRadius: 8, padding: '6px 8px' }}>
                      <b>{cap(m.meal_type)}</b>{m.time ? ` · ${m.time}` : ''} · {m.guest_count} guests
                    </span>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <NextButton v={v} onRun={a.run} primary style={{ flex: 1 }} />
                    {v.quote && <button type="button" onClick={() => a.menuPdf(v)} style={ghostBtn}>Menu PDF</button>}
                    <BookingMenu view={v} actions={a} />
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => a.newOn(picked)}
              style={{ border: '1px dashed #D9C2A5', background: '#FFFCF8', color: '#8A4B00', font: 'inherit', fontSize: 13.5, fontWeight: 600, padding: 11, borderRadius: 10, cursor: 'pointer', minHeight: 44 }}>
              + New booking on {formatDateIST(picked, 'd MMM')}
            </button>
          </div>
          <div style={panel}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{format(month, 'MMMM')} at a glance</h3>
            <span style={{ fontSize: 13, color: '#4A4A45' }}>{inMonth.length} event{inMonth.length === 1 ? '' : 's'} · {inMonth.reduce((s, v) => s + (Number(v.b.guest_count) || 0), 0).toLocaleString('en-IN')} guests</span>
            <span style={{ fontSize: 13, color: '#4A4A45' }}>{endOfMonth(month).getDate() - busy} days free</span>
            {waiting > 0 && <span style={{ fontSize: 13, color: '#8A4B00' }}>{waiting} next step{waiting > 1 ? 's' : ''} waiting</span>}
          </div>
        </aside>
      </div>
    </div>
  );
};

const navBtn: React.CSSProperties = { width: 44, height: 44, border: '1px solid #E0E0DA', background: '#fff', borderRadius: 9, font: 'inherit', fontSize: 17, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { minHeight: 44, padding: '8px 12px', borderRadius: 9, border: '1px solid #E0E0DA', background: '#fff', font: 'inherit', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #E5E5E0', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 };

export default BookingMonth;
