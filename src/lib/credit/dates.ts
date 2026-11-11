import { formatDateIST } from '../ist';

// Whole days between two YYYY-MM-DD dates.
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000);

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// "12 Nov" this year, "12 Nov 2025" otherwise.
export const shortDay = (day: string, today: string) => formatDateIST(day.slice(0, 10), day.slice(0, 4) === today.slice(0, 4) ? 'd MMM' : 'd MMM yyyy');

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
