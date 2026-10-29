import React from 'react';
import { input, label } from './CustomerUi';

// Billing-only styles on top of the shared orange catering look.
export { ORANGE, card, btnPrimary, btnGhost, revealOnPhone } from './CustomerUi';
export const lbl = label;
export const inp = input;
export const box: React.CSSProperties = { background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 };
export const statCard: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: '14px 16px' };
export const statLbl: React.CSSProperties = { fontSize: 11, color: '#888880', marginBottom: 6 };
export const infoLbl: React.CSSProperties = { fontSize: 10, color: '#AAAAAA', marginBottom: 2 };
export const infoVal: React.CSSProperties = { fontSize: 12, color: '#333330', fontWeight: 500 };
export const xBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', flexShrink: 0, lineHeight: 1 };
export const outlineBtn = (color: string): React.CSSProperties => ({ fontSize: 11, color, background: 'none', border: `1px solid ${color}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' });
