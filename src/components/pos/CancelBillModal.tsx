import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { inr } from '../../lib/money';
import { inp, lbl } from '../ui/styles';

interface Props {
  number: string;
  name: string;
  paid: number;
  busy: boolean;
  onCancel: (reason: string, refunded: boolean) => void;
  onClose: () => void;
}

const REASONS = ['Customer changed mind', 'Wrong items billed', 'Billed twice'];

// Cancelling keeps the bill and its number, marked cancelled with the reason.
const CancelBillModal: React.FC<Props> = ({ number, name, paid, busy, onCancel, onClose }) => {
  const [reason, setReason] = useState('');
  const [refunded, setRefunded] = useState(true);
  const ok = !!reason.trim() && !busy;
  return (
    <Modal title={`Cancel bill #${number}?`} onClose={onClose} width={420}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Keep bill</button>
        <button type="button" className="ui-btn danger" disabled={!ok} onClick={() => onCancel(reason.trim(), paid > 0 && refunded)}>Cancel bill</button>
      </>}>
      <div style={{ fontSize: 13, marginBottom: 10 }}>{name}'s bill keeps its number and shows as cancelled. Nothing is deleted.</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={lbl}>Reason *</span>
        <input style={{ ...inp, minHeight: 44 }} value={reason} autoFocus onChange={e => setReason(e.target.value)} placeholder="Why is it cancelled?" />
      </label>
      <div className="pos-tools" style={{ marginTop: 8 }}>
        {REASONS.map(r => <button key={r} type="button" className="ui-btn quiet" onClick={() => setReason(r)}>{r}</button>)}
      </div>
      {paid > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13, minHeight: 44 }}>
          <input type="checkbox" style={{ width: 24, height: 24 }} checked={refunded} onChange={e => setRefunded(e.target.checked)} />
          Gave back {inr(paid)} to the customer
        </label>
      )}
    </Modal>
  );
};

export default CancelBillModal;
