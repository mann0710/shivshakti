import { DocSettings, DEFAULT_DOC_SETTINGS } from './settings';

// Current document settings, GSTIN and logo; kept in step with the database by useDocContextSync.
export interface DocContext { settings: DocSettings; gstNumber?: string; logo: string }

let current: DocContext = { settings: DEFAULT_DOC_SETTINGS, logo: '/logo.png' };

export const docContext = () => current;
export const setDocContext = (patch: Partial<DocContext>) => { current = { ...current, ...patch }; };

let logoJob: { src: string; job: Promise<void> } | null = null;

// Shrinks the logo (the uploaded one, else /logo.png) into an embedded image so PDFs need no network access for it.
export function ensureLogo(): Promise<void> {
  const src = current.settings.logo_url || '/logo.png';
  if (typeof document === 'undefined') return Promise.resolve();
  if (logoJob?.src === src) return logoJob.job;
  setDocContext({ logo: src });
  const job = new Promise<void>(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = 520;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * w);
        const g = canvas.getContext('2d');
        // White under see-through logos, which JPEG would turn black.
        if (g) { g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(img, 0, 0, canvas.width, canvas.height); }
        if (logoJob?.src === src) setDocContext({ logo: canvas.toDataURL('image/jpeg', 0.9) });
      } catch { /* keep the plain URL */ }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
  logoJob = { src, job };
  return job;
}
