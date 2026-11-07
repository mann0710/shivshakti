import React, { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';

export interface MenuItem { label: string; onClick: () => void; danger?: boolean }

// "⋯ More" button with a small menu; closes on outside tap or Esc. `title` shows the items in a dialog instead (inside scrolling tables).
const MoreMenu: React.FC<{ items: MenuItem[]; label?: string; title?: string }> = ({ items, label = 'More', title }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!items.length) return null;
  if (title) return (
    <>
      <button type="button" className="ui-btn quiet" aria-haspopup="dialog" aria-label={`${label} for ${title}`} onClick={() => setOpen(true)}>⋯</button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)} width={360}>
          <div className="pos-menu pos-menu-dialog" role="menu">
            {items.map(i => (
              <button key={i.label} type="button" role="menuitem" className={i.danger ? 'danger' : ''} onClick={() => { setOpen(false); i.onClick(); }}>{i.label}</button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
  return (
    <div className="pos-more" ref={box}>
      <button type="button" className="ui-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯ {label}</button>
      {open && (
        <div className="pos-menu" role="menu">
          {items.map(i => (
            <button key={i.label} type="button" role="menuitem" className={i.danger ? 'danger' : ''} onClick={() => { setOpen(false); i.onClick(); }}>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoreMenu;
