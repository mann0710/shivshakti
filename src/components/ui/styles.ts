import React from 'react';

// Shared inline styles for the sweets screens; colours come from the CSS tokens in index.css.
export const NAVY = 'var(--primary)';
export const NAVY_SOFT = '#FFF1E3';
export const MUTED = '#888880';
export const DANGER = 'var(--danger)';
export const SUCCESS = '#3B6D11';

export const btnPrimary: React.CSSProperties = { background: NAVY, color: '#fff', border: 'none', padding: '10px 16px', minHeight: 40, borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 };
export const btnGhost: React.CSSProperties = { background: '#fff', border: '1px solid #D9D8D2', padding: '9px 14px', minHeight: 40, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
export const btnSm: React.CSSProperties = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };
export const card: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 14 };
export const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 12 };
export const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
export const lbl: React.CSSProperties = { fontSize: 11, color: MUTED, fontWeight: 500 };
export const inp: React.CSSProperties = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff', width: '100%', color: '#1A1A18' };
export const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: MUTED };
export const td: React.CSSProperties = { padding: '9px 12px' };
export const pill = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: bg, color, fontWeight: 600, display: 'inline-block', whiteSpace: 'nowrap' });
export const empty: React.CSSProperties = { color: MUTED, fontSize: 13, textAlign: 'center', padding: '32px 12px' };

export const segBtn = (on: boolean): React.CSSProperties => ({
  flex: 1, padding: '7px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
  background: on ? '#1A1A18' : '#F9F8F5', color: on ? '#fff' : '#444', fontWeight: on ? 600 : 500,
});
export const segWrap: React.CSSProperties = { display: 'flex', border: '1px solid #E5E5E0', borderRadius: 8, overflow: 'hidden' };

export const PRE_STATUS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FFF3E0', color: '#E65100' },
  confirmed: { bg: '#E3F2FD', color: '#1565C0' },
  ready:     { bg: '#EDE7F6', color: '#5E35B1' },
  delivered: { bg: '#EAF3DE', color: SUCCESS },
  cancelled: { bg: '#FEECEC', color: DANGER },
};
