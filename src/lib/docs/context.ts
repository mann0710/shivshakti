import { DocSettings, DEFAULT_DOC_SETTINGS } from './settings';

// Current document settings, GSTIN and logo; kept in step with the database by useDocContextSync.
export interface DocContext { settings: DocSettings; gstNumber?: string; logo: string }

let current: DocContext = { settings: DEFAULT_DOC_SETTINGS, logo: '/logo.png' };

export const docContext = () => current;
export const setDocContext = (patch: Partial<DocContext>) => { current = { ...current, ...patch }; };

let logoJob: Promise<void> | null = null;

// Shrinks the logo into an embedded image so PDFs need no network access for it.
export function ensureLogo(): Promise<void> {
  if (current.logo.startsWith('data:') || typeof document === 'undefined') return Promise.resolve();
  logoJob ??= new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = 520;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * w);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setDocContext({ logo: canvas.toDataURL('image/jpeg', 0.9) });
      } catch { /* keep the plain URL */ }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = '/logo.png';
  });
  return logoJob;
}
