import { useEffect, useState } from 'react';

// Whether the Sweets POS hides the sidebar on a computer; saved on this device, off by default.
const KEY = 'shivshakti.posFull';
const EVENT = 'shivshakti:posFull';

const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

export function setPosFull(on: boolean) {
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* private mode: this visit only */ }
  window.dispatchEvent(new Event(EVENT));
}

// Every user of the hook (layout, POS button, Settings switch) stays in step.
export function usePosFull(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [on, setPosFull];
}
