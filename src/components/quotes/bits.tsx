import React, { useEffect, useState } from 'react';
import { formatDateIST } from '../../lib/ist';
import type { Quotation } from '../../hooks/useQuotations';

// Small pieces shared by the quote list, editor and dialogs.

// True while the media query matches (e.g. phones).
export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [on, setOn] = useState(get);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const fn = () => setOn(m.matches);
    fn();
    m.addEventListener?.('change', fn);
    return () => m.removeEventListener?.('change', fn);
  }, [query]);
  return on;
}
export const PHONE = '(max-width: 768px)';
export const NARROW = '(max-width: 1100px)';

export const DateChip: React.FC<{ iso: string }> = ({ iso }) => (
  <span className="q-date" aria-hidden="true">
    <span className="m">{iso ? formatDateIST(iso, 'MMM').toUpperCase() : '—'}</span>
    <span className="d">{iso ? formatDateIST(iso, 'd') : ''}</span>
  </span>
);

const STATUS: Record<string, [string, string]> = {
  draft: ['draft', 'Draft'], sent: ['sent', 'Sent'], accepted: ['accepted', 'Accepted'], rejected: ['lost', 'Declined'],
};
export const StatusChip: React.FC<{ q: Pick<Quotation, 'status' | 'option_group'>; text?: string }> = ({ q, text }) => {
  const [cls, label] = STATUS[q.status] ?? STATUS.draft;
  return <span className={`q-chip ${cls}`}>{text ?? (q.option_group && q.status === 'rejected' ? 'Not chosen' : label)}</span>;
};

export const Letter: React.FC<{ l?: string | null }> = ({ l }) => (
  <span className={`q-letter ${['A', 'B', 'C'].includes(l || '') ? l : 'X'}`} aria-hidden="true">{l || '·'}</span>
);

// Radio-style card used by every chooser popup.
export const PickCard: React.FC<{ on: boolean; title: React.ReactNode; line?: React.ReactNode; right?: React.ReactNode; onClick: () => void; disabled?: boolean; multi?: boolean }> = ({ on, title, line, right, onClick, disabled, multi }) => (
  <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={disabled} className={`q-card-opt${on ? ' on' : ''}${multi ? ' multi' : ''}`} onClick={onClick}>
    <span className="dot" aria-hidden="true">{multi && on ? '✓' : ''}</span>
    <span className="t"><b>{title}</b>{line && <span className="l">{line}</span>}</span>
    {right != null && <span className="r">{right}</span>}
  </button>
);

// Row of one-tap choices ("Not yet · Cash · UPI · Bank").
export function Chips<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="q-seg-chips">
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export const Field: React.FC<{ label: string; hint?: React.ReactNode; full?: boolean; children: React.ReactNode }> = ({ label, hint, full, children }) => (
  <label className={`q-field${full ? ' full' : ''}`}>
    {label}
    {children}
    {hint && <span className="hint">{hint}</span>}
  </label>
);

export const SumRow: React.FC<{ k: React.ReactNode; v: React.ReactNode; tone?: 'muted' | 'total' }> = ({ k, v, tone }) => (
  <span className={`r${tone ? ` ${tone}` : ''}`}><span>{k}</span><span>{v}</span></span>
);

export const firstName = (q: { customer?: { name?: string } | null }) => String(q.customer?.name || 'the customer').trim().split(/\s+/)[0];
