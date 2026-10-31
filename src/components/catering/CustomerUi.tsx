import React from 'react';

// Orange catering look shared by the Customers and Billing screens.
export const ORANGE = '#E8750A';
export const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
export const btnPrimary: React.CSSProperties = { background: 'var(--primary)', color: '#fff', border: 'none', padding: '8px 14px', minHeight: 36, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
export const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
export const label: React.CSSProperties = { fontSize: 12, color: '#6B6B66', display: 'block', marginBottom: 4 };
export const input: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

// Phones stack the detail panel under the list, so bring it into view after a tap.
export const revealOnPhone = (ref: React.RefObject<HTMLElement>) => {
  if (!window.matchMedia('(max-width: 768px)').matches) return;
  requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};

const TONES = [['#FFF0E0', '#BA7517'], ['#E6F1FB', '#185FA5'], ['#EAF3DE', '#3B6D11'], ['#EEEDFE', '#534AB7']];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const toneOf = (name: string) => Array.from(name).reduce((s, ch) => s + ch.charCodeAt(0), 0) % TONES.length;

// Same colour for a customer in the list and the detail panel.
export const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const [bg, fg] = TONES[toneOf(name)];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size / 3), fontWeight: 600, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
};
