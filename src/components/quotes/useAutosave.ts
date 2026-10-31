import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

interface Options<T> {
  session: string;            // changes when another quote is opened
  snapshot: string;           // everything that would be saved
  ready: boolean;             // false = nothing can be saved yet
  save: () => Promise<T | null>;
  delay?: number;
}

// Saves a moment after the last change; flush() saves now (before send, switch or leave).
export function useAutosave<T>({ session, snapshot, ready, save, delay = 900 }: Options<T>) {
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState('');
  const base = useRef<string | null>(null);
  const snap = useRef(snapshot);
  snap.current = snapshot;
  const saveRef = useRef(save);
  saveRef.current = save;
  const timer = useRef<number>();
  const waiting = useRef(false);
  const running = useRef<Promise<boolean> | null>(null);
  const lastError = useRef('');

  // A freshly opened quote settles (prices, days) before changes count.
  useEffect(() => {
    base.current = null;
    window.clearTimeout(timer.current);
    waiting.current = false;
    setState('saved');
    setError('');
    const t = window.setTimeout(() => { base.current = snap.current; }, 120);
    return () => window.clearTimeout(t);
  }, [session]);

  const run = useCallback(async (): Promise<boolean> => {
    if (running.current) await running.current;
    if (base.current == null || snap.current === base.current) return true;
    const at = snap.current;
    const fail = (msg: string) => { lastError.current = msg; setError(msg); setState('error'); };
    setState('saving');
    const job = (async () => {
      try {
        if (!(await saveRef.current())) { fail('Pick a booking first'); return false; }
        base.current = at;
        setError('');
        setState(snap.current === at ? 'saved' : 'pending');
        return true;
      } catch (e: any) {
        fail(e?.message || 'Could not save');
        return false;
      }
    })();
    running.current = job;
    const ok = await job;
    running.current = null;
    return ok;
  }, []);

  useEffect(() => {
    if (base.current == null || !ready) return;
    if (snapshot === base.current) { setState(s => (s === 'pending' ? 'saved' : s)); return; }
    setState(s => (s === 'saving' ? s : 'pending'));
    window.clearTimeout(timer.current);
    waiting.current = true;
    timer.current = window.setTimeout(() => { waiting.current = false; run(); }, delay);
  }, [snapshot, ready, delay, run]);

  // Leaving the page (sidebar, a link) still saves the last change.
  useEffect(() => () => { if (waiting.current) { window.clearTimeout(timer.current); run(); } }, [run]);

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (state !== 'pending' && state !== 'saving') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state]);

  const flush = useCallback(async () => { window.clearTimeout(timer.current); waiting.current = false; return run(); }, [run]);
  // The latest failure, readable straight after flush() (state updates come a render later).
  const why = useCallback(() => lastError.current || 'Could not save', []);
  return { state, error, flush, why };
}
