import QRCode from 'qrcode';
import { SHOP } from '../shop';

// Inline SVG QR code (synchronous, no image request).
export function qrSvg(text: string, size = 84): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let path = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="UPI QR code"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

// Standard UPI payment link; amount pre-filled when given.
export const upiLink = (upiId: string, amount?: number, note?: string) => {
  const p = new URLSearchParams({ pa: upiId.trim(), pn: SHOP.name, cu: 'INR' });
  if (amount && amount > 0) p.set('am', amount.toFixed(2));
  if (note) p.set('tn', note.slice(0, 60));
  return `upi://pay?${p.toString()}`;
};
