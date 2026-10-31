import React, { useEffect, useState } from 'react';
import { formatDateIST } from '../../lib/ist';
import '../../styles/money.css';

// Small pieces shared by Home, Money and Invoices.

export const TONE_COLOR = { red: '#A32D2D', green: '#0F6E56', amber: '#B26B00', purple: '#4A41A8', ink: 'var(--ink)' } as const;
export type ToneName = keyof typeof TONE_COLOR;

export const Tile: React.FC<{ label: string; value: string; note?: string; tone?: ToneName; onClick?: () => void }> = ({ label, value, note, tone = 'ink', onClick }) => {
  const body = (<>
    <span className="mx-tile-k">{label}</span>
    <span className="mx-tile-v" style={{ color: TONE_COLOR[tone] }}>{value}</span>
    {note && <span className="mx-tile-n">{note}</span>}
  </>);
  return onClick ? <button type="button" className="mx-tile" onClick={onClick}>{body}</button> : <div className="mx-tile">{body}</div>;
};

export const DateTile: React.FC<{ iso: string }> = ({ iso }) => (
  <span className="mx-date" aria-hidden="true">
    <small>{formatDateIST(iso, 'MMM').toUpperCase()}</small>
    <b>{formatDateIST(iso, 'd')}</b>
  </span>
);

export const Chip: React.FC<{ bg: string; fg: string; children: React.ReactNode }> = ({ bg, fg, children }) => (
  <span className="mx-chip" style={{ background: bg, color: fg }}>{children}</span>
);

export const CardHead: React.FC<{ title: React.ReactNode; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="mx-card-head"><h2>{title}</h2>{right && <span>{right}</span>}</div>
);

// Toggle chips: one pick from a short list (Paid by, What for, Period...).
export function Picks<T extends string>({ label, options, value, onPick }: { label: string; options: [T, string][]; value: T; onPick: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="mx-field">
      <span>{label}</span>
      <span className="mx-picks">
        {options.map(([v, text]) => (
          <button key={v} type="button" className="mx-pick" aria-pressed={v === value} onClick={() => onPick(v)}>{text}</button>
        ))}
      </span>
    </div>
  );
}

// The two buttons at the foot of a money dialog.
export const DialogFoot: React.FC<{ onCancel: () => void; onOk: () => void; ok: string; busy?: boolean; disabled?: boolean }> = ({ onCancel, onOk, ok, busy, disabled }) => (
  <>
    <button type="button" className="ui-btn" onClick={onCancel} disabled={busy}>Cancel</button>
    <button type="button" className="ui-btn primary" onClick={onOk} disabled={busy || disabled}>{busy ? 'Saving…' : ok}</button>
  </>
);

export const Empty: React.FC<{ title: string; text?: string; children?: React.ReactNode }> = ({ title, text, children }) => (
  <div className="mx-empty"><b>{title}</b>{text}{children && <div style={{ marginTop: 10 }}>{children}</div>}</div>
);

// Grey shapes in the page's own layout while it loads.
export const Skeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="mx-card mx-skel" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i}><i /><span><i /><i /></span><i /></div>)}
  </div>
);

export const LoadError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="mx-banner" role="alert">
    <span><b>Could not load.</b> Check the internet connection. Nothing you saved is lost.</span>
    <button type="button" className="ui-btn" onClick={onRetry}>Try again</button>
  </div>
);

// The current time, refreshed every minute.
export const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 60000); return () => window.clearInterval(t); }, []);
  return now;
};
export const istClock = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
