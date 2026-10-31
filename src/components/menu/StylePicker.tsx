import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FOOD_STYLES, FoodStyle } from '../../lib/foodStyles';
import '../../styles/menu-sheet.css';

interface Props { anchor: HTMLElement; value: FoodStyle[]; label: string; onToggle: (s: FoodStyle) => void; onClose: () => void }

const WIDTH = 248;

// Small pop-up under a sheet cell: each tap adds or removes one food style.
const StylePicker: React.FC<Props> = ({ anchor, value, label, onToggle, onClose }) => {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const r = anchor.getBoundingClientRect();
  const below = window.innerHeight - r.bottom > 200;
  const at: React.CSSProperties = {
    left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)),
    ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
  };

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const shut = () => close.current();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); shut(); } };
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) shut(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', shut);
    window.addEventListener('scroll', away, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', shut); window.removeEventListener('scroll', away, true); };
  }, []);

  return createPortal(
    <>
      <div className="ms-away" onMouseDown={onClose} />
      <div ref={box} role="dialog" aria-label={label} className="ms-picker" style={{ ...at, width: WIDTH }}>
        {FOOD_STYLES.map(s => (
          <button key={s.id} type="button" className={`ms-chip ${s.cls}`} aria-pressed={value.includes(s.id)} onClick={() => onToggle(s.id)}>{s.label}</button>
        ))}
        <button type="button" className="ui-btn" onClick={onClose}>Done</button>
      </div>
    </>, document.body);
};

export default StylePicker;
