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

// UPI link per the NPCI linking spec: pa, pn, am (2 decimals), cu=INR, tn. Spaces as %20 and a bare @ in the VPA, which every UPI app reads.
const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, '@');
export const upiLink = (upiId: string, amount?: number, note?: string) => {
  const parts: [string, string][] = [['pa', upiId.trim()], ['pn', SHOP.name]];
  if (amount && amount > 0) parts.push(['am', amount.toFixed(2)]);
  parts.push(['cu', 'INR']);
  const tn = note?.replace(/[^\w .,/-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (tn) parts.push(['tn', tn]);
  return `upi://pay?${parts.map(([k, v]) => `${k}=${enc(v)}`).join('&')}`;
};
