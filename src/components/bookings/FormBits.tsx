import React from 'react';
import '../../styles/bookings-dialogs.css';

// Small form pieces shared by the booking dialogs.
export const Group: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bkf-group" aria-label={title}>
    {title && <span className="bkf-head">{title}</span>}
    <div className="bkf-grid">{children}</div>
  </section>
);

interface FieldProps { label: string; hint?: string; error?: string; warn?: boolean; full?: boolean; phoneFull?: boolean; htmlFor?: string; children: React.ReactNode }

// Label, control, then one hint or error line underneath.
export const Field: React.FC<FieldProps> = ({ label, hint, error, warn, full, phoneFull, htmlFor, children }) => (
  <div className={`bkf-field${full ? ' bkf-full' : ''}${phoneFull ? ' bkf-phone-full' : ''}`}>
    <label className="bkf-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {(error || hint) && <span className={`bkf-hint${error ? ' bad' : warn ? ' warn' : ''}`} role={error ? 'alert' : undefined}>{error || hint}</span>}
  </div>
);

interface ChipsProps { label: string; options: string[]; value: string; onPick: (v: string) => void; extra?: React.ReactNode; full?: boolean; phoneFull?: boolean; error?: string }

// One-tap choices (event, food style); the picked chip is outlined.
export const Chips: React.FC<ChipsProps> = ({ label, options, value, onPick, extra, full, phoneFull, error }) => (
  <div className={`bkf-field${full ? ' bkf-full' : ''}${phoneFull ? ' bkf-phone-full' : ''}`} role="group" aria-label={label}>
    <span className="bkf-label">{label}</span>
    <span className="bkf-chips">
      {options.map(o => <button key={o} type="button" className="bkf-chip" aria-pressed={o === value} onClick={() => onPick(o)}>{o}</button>)}
      {extra}
    </span>
    {error && <span className="bkf-hint bad" role="alert">{error}</span>}
  </div>
);

export const inputClass = (bad?: string, strong?: boolean) => `bkf-input${bad ? ' bad' : ''}${strong ? ' strong' : ''}`;

// Cancel goes through the dialog's own ×, so typed changes are asked about first.
const askClose = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.closest('.ui-modal')?.querySelector<HTMLButtonElement>('.ui-modal-x')?.click();

// Cancel + the main button; on phones they stack full width with the main one on top.
export const DialogFoot: React.FC<{ label: string; busy?: boolean; onSave: () => void }> = ({ label, busy, onSave }) => (
  <div className="bkf-foot">
    <button type="button" className="ui-btn" onClick={askClose} disabled={busy}>Cancel</button>
    <button type="button" className="ui-btn primary" onClick={onSave} disabled={busy}>{busy ? 'Saving…' : label}</button>
  </div>
);
