// Text size for this device: scales the whole app (index.css --text-size × the wide-screen zoom).
export const TEXT_SIZES = [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
const KEY = 'shivshakti.textSize';

const nearest = (v: number) => TEXT_SIZES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), 1);

export function readTextSize(): number {
  try { const v = parseFloat(localStorage.getItem(KEY) ?? ''); return Number.isFinite(v) ? nearest(v) : 1; } catch { return 1; }
}

export const applyTextSize = (v: number) => document.documentElement.style.setProperty('--text-size', String(v));

export function saveTextSize(v: number): number {
  const size = nearest(v);
  try { if (size === 1) localStorage.removeItem(KEY); else localStorage.setItem(KEY, String(size)); } catch { /* private mode: lasts this visit only */ }
  applyTextSize(size);
  return size;
}

// One step smaller or bigger, staying inside the list.
export const stepTextSize = (v: number, dir: -1 | 1) => TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, TEXT_SIZES.indexOf(nearest(v)) + dir))];

export const textSizeLabel = (v: number) => `${Math.round(v * 100)}%`;
