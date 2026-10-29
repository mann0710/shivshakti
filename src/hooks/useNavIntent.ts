import { useEffect, useState } from 'react';
import type { Page } from '../components/navItems';

// One-shot instruction for the next page, e.g. open its "new" form or preselect a booking.
export interface NavIntent { action: 'new' | 'open'; id?: string }

let pending: (NavIntent & { page: Page }) | null = null;

export const setNavIntent = (page: Page, intent?: NavIntent) => {
  pending = intent ? { ...intent, page } : null;
};

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
