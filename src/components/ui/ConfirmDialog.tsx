import React, { useCallback, useState } from 'react';
import Modal from './Modal';
import { btnGhost, btnPrimary, DANGER } from './styles';

interface Ask { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; resolve: (ok: boolean) => void }

// Promise-based confirm that replaces window.confirm: `if (!(await confirm({...}))) return;`
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);

  const confirm = useCallback(
    (opts: Omit<Ask, 'resolve'>) => new Promise<boolean>(resolve => setAsk({ ...opts, resolve })),
    [],
  );

  const close = (ok: boolean) => { ask?.resolve(ok); setAsk(null); };

  const dialog = ask ? (
    <Modal
      title={ask.title}
      onClose={() => close(false)}
      width={400}
      footer={<>
        <button style={btnGhost} onClick={() => close(false)}>Cancel</button>
        <button style={{ ...btnPrimary, background: ask.danger ? DANGER : btnPrimary.background }} onClick={() => close(true)} autoFocus>
          {ask.confirmLabel ?? 'Confirm'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{ask.message}</div>
    </Modal>
  ) : null;

  return { confirm, dialog };
}
