import React, { useEffect, useState } from 'react';
import '../../styles/settings.css';

// Building blocks for the Settings groups: rows, fields that save on blur, switches and "coming soon".

export const Panel: React.FC<{ title: string; sub: string; children: React.ReactNode; id?: string }> = ({ title, sub, children, id }) => (
  <section className="st-panel" aria-labelledby={id ? `${id}-h` : undefined}>
    <div className="st-panel-head"><h2 id={id ? `${id}-h` : undefined}>{title}</h2><p>{sub}</p></div>
    {children}
  </section>
);

interface RowProps { label: string; note?: React.ReactNode; warn?: boolean; children?: React.ReactNode }
export const Row: React.FC<RowProps> = ({ label, note, warn, children }) => (
  <div className="st-row">
    <span className="st-row-main"><span>{label}</span>{note && <small className={warn ? 'warn' : ''}>{note}</small>}</span>
    <span className="st-row-end">{children}</span>
  </div>
);

export const Soon: React.FC<{ label: string; note?: string }> = ({ label, note }) => (
  <Row label={label} note={note}><span className="st-soon">Coming soon</span></Row>
);

interface SwitchProps { label: string; on: boolean; disabled?: boolean; words?: [string, string]; onChange: (v: boolean) => void }
export const Switch: React.FC<SwitchProps> = ({ label, on, disabled, words = ['On', 'Off'], onChange }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="st-switch" onClick={() => onChange(!on)}>
    <i aria-hidden="true" /><span>{on ? words[0] : words[1]}</span>
  </button>
);

export const ToggleRow: React.FC<RowProps & { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({ on, disabled, onChange, ...row }) => (
  <Row {...row}><Switch label={row.label} on={on} disabled={disabled} onChange={onChange} /></Row>
);

interface FieldProps {
  label: string;
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  hint?: string;
  warn?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  full?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  check?: (v: string) => string | null;
}

// Saves when the field loses focus (or on Enter); a failed check shows under the field and nothing is saved.
export const Field: React.FC<FieldProps> = ({ label, value, onSave, placeholder, hint, warn, disabled, multiline, full, inputMode, check }) => {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(value); }, [value]);
  const commit = () => {
    if (text === value) return;
    const problem = check?.(text) ?? null;
    setError(problem);
    if (!problem) onSave(text);
  };
  const common = {
    value: text, placeholder, disabled, 'aria-invalid': !!error || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setText(e.target.value); setError(null); },
    onBlur: commit,
  };
  return (
    <label className={`st-field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {multiline
        ? <textarea rows={4} {...common} />
        : <input inputMode={inputMode} className={error ? 'bad' : ''} {...common} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />}
      {(error || hint) && <small className={error ? 'bad' : warn ? 'warn' : ''}>{error || hint}</small>}
    </label>
  );
};

export const LinkBtn: React.FC<{ onClick?: () => void; href?: string; warn?: boolean; children: React.ReactNode }> = ({ onClick, href, warn, children }) =>
  href ? <a className={`st-link${warn ? ' warn' : ''}`} href={href}>{children}</a>
    : <button type="button" className={`st-link${warn ? ' warn' : ''}`} onClick={onClick}>{children}</button>;

export const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="st-notice" role="status">{children}</div>;
