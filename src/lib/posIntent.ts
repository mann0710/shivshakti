import type { NavIntent } from '../hooks/useNavIntent';
import type { ReportId } from './reports';
import type { PosMode } from './posForm';

export type PosTabId = 'pos' | 'orders' | 'preorders' | 'close' | 'reports';
type Who = NonNullable<NavIntent['who']>;

// Where the POS opens and what it prefills.
export interface PosStart { tab: PosTabId; mode?: PosMode; who?: Who; report?: ReportId; openId?: string }

// Links into the POS from other screens; posStart reads them back.
export const posLink = {
  bill: (who?: Who): NavIntent => ({ action: 'new', id: 'bill', who }),
  preorder: (who?: Who): NavIntent => ({ action: 'new', id: 'preorder', who }),
  bills: (who?: Who): NavIntent => ({ action: 'open', id: 'orders', who }),
  preorders: (openId?: string, who?: Who): NavIntent => ({ action: 'open', id: openId ? `preorders:${openId}` : 'preorders', who }),
  close: (): NavIntent => ({ action: 'open', id: 'close' }),
  report: (id?: ReportId): NavIntent => ({ action: 'open', id: id ? `report:${id}` : 'reports' }),
};

export function posStart(intent: NavIntent | null | undefined): PosStart {
  const [what = '', arg] = (intent?.id ?? '').split(':');
  const who = intent?.who;
  if (what === 'bill' || what === 'preorder') return { tab: 'pos', mode: what, who };
  if (what === 'orders') return { tab: 'orders', who };
  if (what === 'preorders') return { tab: 'preorders', who, openId: arg || undefined };
  if (what === 'close') return { tab: 'close' };
  if (what === 'reports' || what === 'report') return { tab: 'reports', report: (arg as ReportId) || undefined };
  return { tab: 'pos' };
}
