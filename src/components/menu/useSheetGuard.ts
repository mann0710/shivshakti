import { useEffect, useRef, useState } from 'react';
import { setLeaveGuard } from '../../hooks/useLeaveGuard';
import type { useConfirm } from '../ui/ConfirmDialog';
import { plural } from '../../lib/menuCatalog';

type Confirm = ReturnType<typeof useConfirm>['confirm'];

// Menu Builder's sheet mode; leaving it or moving away with unsaved changes asks first.
export function useSheetGuard(confirm: Confirm, allowed: boolean) {
  const [on, setOn] = useState(false);
  const [dirty, setDirty] = useState(0);

  // A search or a whole category has no sheet; coming back opens the list.
  useEffect(() => { if (!allowed) setOn(false); }, [allowed]);

  // Closing the tab with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Runs `go` straight away, or once the owner agrees to throw the changes away.
  const guard = async (go: () => void) => {
    if (dirty && !(await confirm({
      title: `Throw away ${plural(dirty, 'unsaved change')}?`,
      message: 'They are only in the sheet; nothing has been saved yet.',
      confirmLabel: 'Throw away', cancelLabel: 'Keep editing', danger: true,
    }))) return;
    go();
  };

  // Moving to another page from the menu asks too.
  const latest = useRef(guard);
  latest.current = guard;
  useEffect(() => {
    if (!dirty) return;
    setLeaveGuard(go => latest.current(go));
    return () => setLeaveGuard(null);
  }, [dirty]);

  return {
    sheet: on && allowed,
    dirty,
    setDirty,
    toggle: (v: boolean) => (v ? setOn(true) : guard(() => setOn(false))),
    // After a save: back to the list without asking.
    done: () => { setDirty(0); setOn(false); },
    guard,
  };
}
