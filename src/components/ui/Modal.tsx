import React, { useEffect } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

// Centered dialog on desktop, bottom sheet on phones; Esc and backdrop close it.
const Modal: React.FC<Props> = ({ title, onClose, children, footer, width = 460 }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ui-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}>
        <div className="ui-modal-head">
          <span>{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="ui-modal-x">×</button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
