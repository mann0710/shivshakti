import React, { useMemo } from 'react';
import { useDocSettings } from '../../hooks/useDocSettings';
import { qrSvg, upiLink } from '../../lib/docs/qr';
import { inr } from '../../lib/money';
import { lbl } from '../ui/styles';

interface Props {
  amount: number;
  note: string;              // shows in the customer's UPI app
  action?: React.ReactNode;  // the "Received" button
}

// Amount to ask for by UPI, with a QR when a UPI ID is saved in Settings.
const UpiPanel: React.FC<Props> = ({ amount, note, action }) => {
  const id = useDocSettings().upi_id.trim();
  const svg = useMemo(() => (id && amount > 0 ? qrSvg(upiLink(id, amount, note), 132) : ''), [id, amount, note]);
  return (
    <div className="pos-upi" role="group" aria-label="UPI payment">
      {/* QR markup is built locally from the saved UPI ID and amount */}
      {svg && <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'stretch' }}>
        <span style={lbl}>Ask for UPI</span>
        <span className="amt">{inr(amount)}</span>
        {id
          ? <span style={{ fontSize: 12, color: '#5A5A55', overflowWrap: 'anywhere' }}>Scan with any UPI app · {id}</span>
          : <span className="pos-note">Add your UPI ID in Settings → Money &amp; tax to show a QR code here.</span>}
        {action}
      </div>
    </div>
  );
};

export default UpiPanel;
