import React from 'react';
import Modal from '../ui/Modal';

// Shared bits for the credit dialogs: chip choices, a labelled field and the dialog frame.

export function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="cr-dlg" style={{ gap: 5 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#4A4A45' }}>{label}</span>
      <span className="cr-pick" role="group" aria-label={label}>
        {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
      </span>
    </div>
  );
}

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="f">{label}{children}</label>;

interface DlgProps { title: string; onClose: () => void; primary: string; onSave: () => void; busy?: boolean; disabled?: boolean; danger?: boolean; left?: React.ReactNode; children: React.ReactNode }

export const Dlg: React.FC<DlgProps> = ({ title, onClose, primary, onSave, busy, disabled, danger, left, children }) => (
  <Modal title={title} onClose={onClose} width={520} busy={busy} footer={
    <>
      {left}<span style={{ flex: 1 }} />
      <button type="button" className="ui-btn" onClick={onClose} disabled={busy}>Cancel</button>
      <button type="button" className={`ui-btn ${danger ? 'danger' : 'primary'}`} onClick={onSave} disabled={busy || disabled}>{busy ? 'Saving…' : primary}</button>
    </>
  }>
    <div className="cr-dlg">{children}</div>
  </Modal>
);

export const amountOf = (text: string) => Math.max(0, Math.round((Number(text.replace(/[₹,\s]/g, '')) || 0) * 100) / 100);
