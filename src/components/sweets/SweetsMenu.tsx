import React, { useEffect, useRef, useState } from 'react';
import '../../styles/sweets.css';

export interface SweetsMenuItem { label: string; onClick: () => void; strong?: boolean; danger?: boolean; sep?: boolean; hint?: string; disabled?: boolean }

// "⋯" button with a short action list; closes on outside tap or Esc, arrow keys move between items.
const SweetsMenu: React.FC<{ label: string; items: SweetsMenuItem[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const list = () => Array.from(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    list()[0]?.focus();
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); box.current?.querySelector<HTMLButtonElement>('.sw-more')?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const els = list();
      const at = els.indexOf(document.activeElement as HTMLButtonElement);
      els[(at + (e.key === 'ArrowDown' ? 1 : els.length - 1)) % els.length]?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', keys); };
  }, [open]);

  return (
    <div className="sw-menu-wrap" ref={box}>
      <button type="button" className="sw-more" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
      {open && (
        <div className="sw-menu" role="menu" aria-label={label}>
          {items.map(i => (
            <React.Fragment key={i.label}>
              {i.sep && <div className="sep" role="separator" />}
              <button type="button" role="menuitem" disabled={i.disabled} className={[i.strong && 'strong', i.danger && 'danger'].filter(Boolean).join(' ')}
                onClick={() => { setOpen(false); i.onClick(); }}>
                <span>{i.label}</span>{i.hint && <small>{i.hint}</small>}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default SweetsMenu;
