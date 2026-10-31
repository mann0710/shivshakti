import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, measure } from '../../lib/viewport';
import '../../styles/bookings-dialogs.css';

export interface MenuItem {
  label: string;
  hint?: string;
  strong?: boolean;
  danger?: boolean;
  checked?: boolean;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  submenu?: MenuItem[][];
}
export type MenuGroups = MenuItem[][];

interface Props {
  label: string;           // what the menu is for, read out by screen readers
  groups: MenuGroups;
  trigger: React.ReactNode;
  triggerClass: string;
  triggerLabel?: string;
  triggerStyle?: React.CSSProperties;
}

const WIDTH = 280;
const SUB_WIDTH = 240;
const ITEM = '[data-mi]';

// Moves focus between the items of one menu panel.
const focusItem = (box: HTMLElement | null, to: number | 'first' | 'last' | 'checked') => {
  const els = Array.from(box?.querySelectorAll<HTMLElement>(ITEM) ?? []);
  if (!els.length) return;
  const at = els.indexOf(document.activeElement as HTMLElement);
  const i = to === 'first' ? 0 : to === 'last' ? els.length - 1
    : to === 'checked' ? Math.max(0, els.findIndex(e => e.getAttribute('aria-checked') === 'true'))
    : (at + to + els.length) % els.length;
  els[i].focus();
};

const place = (r: Box, rows: number): React.CSSProperties => {
  const h = Math.min(rows * 44 + 40, r.vh * 0.7);
  const below = r.vh - r.bottom - 8 >= h || r.top < h;
  return { width: Math.min(WIDTH, r.vw - 16), right: Math.max(8, r.vw - r.right),
    ...(below ? { top: Math.min(r.bottom + 6, r.vh - h - 8) } : { bottom: r.vh - r.top + 6 }) };
};

// Beside the main menu when there is room, else on top of it with a Back row.
const placeSub = (menu: Box, item: Box, rows: number): { style: React.CSSProperties; inPlace: boolean } => {
  const h = rows * 44 + 24;
  const top = Math.max(8, Math.min(item.top - 6, menu.vh - h - 8));
  if (menu.left - SUB_WIDTH - 6 >= 8) return { style: { width: SUB_WIDTH, left: menu.left - SUB_WIDTH - 6, top }, inPlace: false };
  if (menu.right + SUB_WIDTH + 6 <= menu.vw - 8) return { style: { width: SUB_WIDTH, left: menu.right + 6, top }, inPlace: false };
  return { style: { width: menu.width, left: menu.left, top: menu.top }, inPlace: true };
};

// A ⋯ menu: 44 px rows in groups, arrow keys move, → opens a submenu beside, Esc steps back.
const ActionMenu: React.FC<Props> = ({ label, groups, trigger, triggerClass, triggerLabel, triggerStyle }) => {
  const [at, setAt] = useState<React.CSSProperties | null>(null);
  // Submenu by its row key, so a fresh `groups` from a re-render still finds it.
  const [sub, setSub] = useState<{ key: string; style: React.CSSProperties; inPlace: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLDivElement>(null);
  const subFrom = useRef<HTMLElement | null>(null);

  const close = (refocus = true) => { subFrom.current = null; setAt(null); setSub(null); if (refocus) btn.current?.focus(); };
  const closeSub = () => setSub(null);
  const subItem = sub ? groups.filter(g => g.length)[Number(sub.key.split('-')[0])]?.[Number(sub.key.split('-')[1])] : undefined;

  useEffect(() => {
    if (!at) return;
    focusItem(main.current, 'first');
    const shut = () => { setAt(null); setSub(null); };
    // Scrolling the page closes the menu; scrolling inside it does not.
    const off = (e: Event) => { if (!(e.target instanceof Node) || !(main.current?.contains(e.target) || side.current?.contains(e.target))) shut(); };
    window.addEventListener('resize', shut);
    window.addEventListener('scroll', off, true);
    return () => { window.removeEventListener('resize', shut); window.removeEventListener('scroll', off, true); };
  }, [at]);
  // Opening a submenu focuses its current pick; closing it returns to the row that opened it.
  useEffect(() => { if (sub) focusItem(side.current, 'checked'); else subFrom.current?.focus(); }, [sub]);

  const toggle = () => {
    if (at) return close();
    const rows = groups.reduce((n, g) => n + g.length, 0);
    setAt(place(measure(btn.current!), rows));
  };

  const openSub = (item: MenuItem, key: string, el: HTMLElement) => {
    subFrom.current = el;
    const rows = (item.submenu ?? []).reduce((n, g) => n + g.length, 0) + 1;
    setSub({ key, ...placeSub(measure(main.current!), measure(el), rows) });
  };

  // Keys stay inside the menu so a dialog behind it does not close too.
  const onKey = (level: 'main' | 'sub') => (e: React.KeyboardEvent) => {
    const box = level === 'main' ? main.current : side.current;
    const el = e.target as HTMLElement;
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') { handled(); focusItem(box, 1); }
    else if (e.key === 'ArrowUp') { handled(); focusItem(box, -1); }
    else if (e.key === 'Home') { handled(); focusItem(box, 'first'); }
    else if (e.key === 'End') { handled(); focusItem(box, 'last'); }
    else if (e.key === 'Escape') { handled(); if (level === 'sub') closeSub(); else close(); }
    else if (e.key === 'ArrowLeft' && level === 'sub') { handled(); closeSub(); }
    else if (e.key === 'ArrowRight' && level === 'main' && el.getAttribute('aria-haspopup') === 'menu') { handled(); el.click(); }
    else if (e.key === 'Tab') close(false);
  };

  const row = (item: MenuItem, key: string) => {
    const cls = `am-item${item.strong ? ' strong' : ''}${item.danger ? ' danger' : ''}${sub?.key === key ? ' open' : ''}`;
    const role = item.checked === undefined ? 'menuitem' : 'menuitemradio';
    const body = <><span>{item.label}</span>{(item.hint || item.checked) && <span className="am-hint">{item.checked ? '✓' : item.hint}</span>}</>;
    if (item.href) {
      return <a key={key} data-mi="" role={role} className={cls} href={item.href} tabIndex={-1} onClick={() => close(false)}
        {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>;
    }
    if (item.submenu) {
      return <button key={key} data-mi="" type="button" role="menuitem" className={cls} tabIndex={-1} aria-haspopup="menu" aria-expanded={sub?.key === key}
        onClick={e => (sub?.key === key ? closeSub() : openSub(item, key, e.currentTarget))}>{body}</button>;
    }
    return <button key={key} data-mi="" type="button" role={role} aria-checked={item.checked} className={cls} tabIndex={-1}
      onClick={() => { close(); item.onSelect?.(); }}>{body}</button>;
  };

  const panel = (list: MenuGroups, level: 'main' | 'sub') => list.filter(g => g.length).map((g, gi) => (
    <React.Fragment key={gi}>
      {gi > 0 && <span className="am-sep" aria-hidden="true" />}
      {g.map((item, i) => row(item, `${level === 'main' ? '' : 's'}${gi}-${i}`))}
    </React.Fragment>
  ));

  return (
    <>
      <button ref={btn} type="button" className={triggerClass} style={triggerStyle} aria-label={triggerLabel} aria-haspopup="menu" aria-expanded={!!at} onClick={toggle}>
        {trigger}
      </button>
      {at && createPortal(
        <>
          <div className="am-veil" onMouseDown={() => close(false)} />
          <div ref={main} role="menu" aria-label={label} className="am-pop" style={{ ...at, visibility: sub?.inPlace ? 'hidden' : undefined }} onKeyDown={onKey('main')}>
            {panel(groups, 'main')}
          </div>
          {sub && subItem && (
            <div ref={side} role="menu" aria-label={subItem.label} className="am-pop sub" style={sub.style} onKeyDown={onKey('sub')}>
              {sub.inPlace && <button data-mi="" type="button" role="menuitem" className="am-item" tabIndex={-1} onClick={closeSub}>‹ Back</button>}
              {panel(subItem.submenu ?? [], 'sub')}
            </div>
          )}
        </>, document.body)}
    </>
  );
};

export default ActionMenu;
