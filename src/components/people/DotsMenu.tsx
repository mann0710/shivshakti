import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { measure } from '../../lib/viewport';
import '../../styles/people.css';

export interface DotsItem { label: string; onClick?: () => void; href?: string; danger?: boolean; hint?: string; sep?: boolean; strong?: boolean }

interface Props { label: string; items: DotsItem[]; className?: string }

// "⋯" button with a floating menu; closes on outside tap, Esc, scroll or resize.
const DotsMenu: React.FC<Props> = ({ label, items, className = '' }) => {
  const [at, setAt] = useState<React.CSSProperties | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); btn.current?.focus(); }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const all = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const i = all.indexOf(document.activeElement as HTMLElement);
      all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [at]);

  const toggle = () => {
    if (at) return close();
    const r = measure(btn.current!);
    const below = r.vh - r.bottom > 320;
    setAt({ right: Math.max(8, r.vw - r.right), ...(below ? { top: r.bottom + 6 } : { bottom: r.vh - r.top + 6 }) });
  };

  return (
    <>
      <button ref={btn} type="button" className={`pp-dots ${className}`} aria-label={label} aria-haspopup="menu" aria-expanded={!!at} onClick={toggle}>⋯</button>
      {at && createPortal(
        <>
          <div className="pp-menu-away" onMouseDown={close} />
          <div ref={menu} role="menu" aria-label={label} className="pp-menu" style={at}>
            {items.map(i => {
              const cls = `pp-mi${i.danger ? ' danger' : ''}${i.strong ? ' strong' : ''}${i.sep ? ' sep' : ''}`;
              const body = <><span>{i.label}</span>{i.hint && <small>{i.hint}</small>}</>;
              return i.href
                ? <a key={i.label} role="menuitem" className={cls} href={i.href} target={i.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" onClick={close}>{body}</a>
                : <button key={i.label} type="button" role="menuitem" className={cls} onClick={() => { close(); i.onClick?.(); }}>{body}</button>;
            })}
          </div>
        </>, document.body)}
    </>
  );
};

export default DotsMenu;
