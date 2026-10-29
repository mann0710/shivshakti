import { useEffect, useState } from 'react';

const read = <T,>(key: string | null, fallback: T): T => {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

// useState that survives a refresh; a null key keeps it in memory only.
export function useStoredState<T extends object>(key: string | null, initial: () => T) {
  const [value, setValue] = useState<T>(() => read(key, initial()));
  useEffect(() => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  }, [key, value]);
  return [value, setValue] as const;
}
