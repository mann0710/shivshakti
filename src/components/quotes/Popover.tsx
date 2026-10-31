import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { measure } from '../../lib/viewport';

interface Props {
  anchor: HTMLElement | null;
  label: string;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
  role?: 'menu' | 'dialog';
}

// Floats beside the button that opened it; a bottom sheet on phones (CSS).
const Popover: React.FC<Props> = ({ anchor, label, width = 260, onClose, children, role = 'dialog' }) => {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    if (!anchor) return;
    const r = measure(anchor);
    const h = box.current?.offsetHeight ?? 300;
    const below = r.vh - r.bottom > h + 12 || r.top < h + 12;
    const left = r.left + width <= r.vw - 8 ? r.left : Math.max(8, r.right - width);
    setAt({ left, width, ...(below ? { top: r.bottom + 6 } : { bottom: r.vh - r.top + 6 }) });
  }, [anchor, width]);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    const onScroll = (e: Event) => { if (!box.current?.contains(e.target as Node)) close.current(); };
    const onResize = () => close.current();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      back?.focus?.();
    };
  }, []);

  // Portal clicks still bubble through React; keep them from reaching the row underneath.
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return createPortal(
    <>
      <div className="q-pop-back" onMouseDown={() => close.current()} onClick={stop} />
      <div ref={box} className="q-pop" role={role} aria-label={label} style={at} onClick={stop}>{children}</div>
    </>, document.body);
};

export default Popover;
