import React, { useRef, useState } from 'react';

interface Props { value?: string; label: string; placeholder?: string; className?: string; onDone: (name: string | null) => void }

// A one-line name box: Enter or leaving it saves (trimmed), Esc cancels (null).
const InlineName: React.FC<Props> = ({ value = '', label, placeholder, className, onDone }) => {
  const [text, setText] = useState(value);
  const cancelled = useRef(false);
  return (
    <input className={className} autoFocus aria-label={label} placeholder={placeholder} value={text} onChange={e => setText(e.target.value)}
      onBlur={() => onDone(cancelled.current ? null : text.trim())}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; e.currentTarget.blur(); }
      }} />
  );
};

export default InlineName;
