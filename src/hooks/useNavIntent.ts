import { useEffect, useState } from 'react';
import type { Page } from '../components/navItems';

// One-shot instruction for the next page, e.g. open its "new" form or preselect a booking.
// `who` prefills a customer (name + phone) where the page supports it.
export interface NavIntent { action: 'new' | 'open'; id?: string; who?: { name: string; phone: string } }

let pending: (NavIntent & { page: Page }) | null = null;
let moves = 0;

export const setNavIntent = (page: Page, intent?: NavIntent) => {
  moves += 1;
  pending = intent ? { ...intent, page } : null;
};

// True once the user has moved between pages in this tab, so history.back() stays inside the app.
export const canGoBack = () => moves > 0;

// Read on mount and cleared in an effect, so StrictMode's double initialiser still sees it.
export function useNavIntent(page: Page): NavIntent | null {
  const [intent] = useState<NavIntent | null>(() => {
    if (pending?.page !== page) return null;
    const { page: _p, ...rest } = pending;
    return rest;
  });
  useEffect(() => {
    if (pending?.page === page) pending = null;
  }, [page]);
  return intent;
}

export type Navigate = (page: Page, intent?: NavIntent) => void;
