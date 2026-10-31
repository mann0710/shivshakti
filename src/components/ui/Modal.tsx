import React, { useEffect, useRef, useState } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  // 'panel' slides in from the right on a computer; phones always get a bottom sheet.
  variant?: 'center' | 'panel';
  // Ask before throwing away typed changes.
  dirty?: boolean;
  // Saving: closing is blocked.
  busy?: boolean;
}

// Open dialogs, newest last: only the top one reacts to Esc and Tab.
const stack: number[] = [];
let seq = 0;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal: React.FC<Props> = ({ title, onClose, children, footer, width = 460, variant = 'center', dirty, busy }) => {
  const id = useRef(++seq);
  const box = useRef<HTMLDivElement>(null);
  // Read during the first render, before any field inside autofocuses.
  const opener = useRef(document.activeElement as HTMLElement | null);
  const [asking, setAsking] = useState(false);
  const close = useRef(() => {});
  close.current = () => { if (busy) return; if (dirty && !asking) { setAsking(true); return; } onClose(); };

  useEffect(() => {
    const me = id.current;
    const back = opener.current;
    stack.push(me);
    document.body.classList.add('modal-open');
    // Keep a field's own autoFocus; otherwise start on the first field, not the × button (phones skip this so the keyboard stays down).
    if (window.matchMedia('(min-width: 769px)').matches && !box.current?.contains(document.activeElement)) {
      box.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key === 'Tab' && box.current) {
        const els = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!els.length) return;
        const [first, last] = [els[0], els[els.length - 1]];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      if (!stack.length) document.body.classList.remove('modal-open');
      back?.focus?.();
    };
  }, []);

  return (
    <div className={`ui-modal-backdrop${variant === 'panel' ? ' panel' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) close.current(); }}>
      <div ref={box} className={`ui-modal${variant === 'panel' ? ' panel' : ''}`} role="dialog" aria-modal="true" aria-label={title} style={variant === 'panel' ? undefined : { maxWidth: width }}>
        <div className="ui-modal-head">
          <span>{title}</span>
          <button type="button" aria-label="Close" onClick={() => close.current()} className="ui-modal-x" disabled={busy}>×</button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {asking ? (
          <div className="ui-modal-foot ask" role="alert">
            <span style={{ flex: 1, fontSize: 14 }}>Throw away what you typed?</span>
            <button type="button" className="ui-btn" onClick={() => setAsking(false)}>Keep editing</button>
            <button type="button" className="ui-btn danger" onClick={onClose}>Throw away</button>
          </div>
        ) : footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
