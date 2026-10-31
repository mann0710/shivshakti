import React from 'react';
import Modal from '../ui/Modal';
import { HeldBill, heldSummary } from '../../lib/heldBills';

interface Props {
  list: HeldBill[];
  onRestore: (id: string) => void;
  onDrop: (id: string) => void;
  onClose: () => void;
}

// Bills kept aside; restoring one holds whatever is on the counter in its place.
const HeldBills: React.FC<Props> = ({ list, onRestore, onDrop, onClose }) => (
  <Modal title={`Held bills (${list.length})`} onClose={onClose} width={440}>
    {list.length === 0 && <div style={{ color: '#5A5A55', fontSize: 13 }}>No bills on hold.</div>}
    {list.map(h => {
      const s = heldSummary(h);
      return (
        <div key={h.id} className="held-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#5A5A55' }}>{s.detail}</div>
          </div>
          <button type="button" className="ui-btn primary" onClick={() => onRestore(h.id)}>Restore</button>
          <button type="button" className="ui-btn" aria-label={`Remove held bill of ${s.name}`} onClick={() => onDrop(h.id)}>Remove</button>
        </div>
      );
    })}
    <div style={{ fontSize: 12, color: '#5A5A55', marginTop: 10 }}>Held bills stay on this device only.</div>
  </Modal>
);

export default HeldBills;
