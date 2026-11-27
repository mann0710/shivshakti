import { useSyncExternalStore } from 'react';
import type { Page } from '../components/navItems';
import { Route, parseRoute, pathFor } from '../lib/route';

// The address bar is the app's route: every page and open record has its own link.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener('popstate', l);
  window.addEventListener('hashchange', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('popstate', l);
    window.removeEventListener('hashchange', l);
  };
}

const snapshot = () => window.location.pathname + window.location.hash;
export const currentRoute = (): Route => parseRoute(window.location.pathname, window.location.hash);

export function useRoute(): Route {
  useSyncExternalStore(subscribe, snapshot);
  return currentRoute();
}

// Opens a page or record; replace swaps the current history entry instead of adding one.
export function goTo(page: Page, id?: string, replace = false) {
  const path = pathFor(page, id);
  if (path === window.location.pathname && !window.location.hash) return;
  if (replace) window.history.replaceState(window.history.state, '', path);
  else window.history.pushState({ inApp: true }, '', path);
  notify();
}

// Closes a record: Back when the app opened it (returns to the opener), else straight to the page.
export function closeRoute(page: Page) {
  if (window.history.state?.inApp) window.history.back();
  else goTo(page, undefined, true);
}

// The record open on this page, from the address.
export function useRecordRoute(page: Page) {
  const r = useRoute();
  return {
    id: r.page === page ? r.id : undefined,
    open: (id?: string, replace = false) => goTo(page, id, replace),
    close: () => closeRoute(page),
  };
}
