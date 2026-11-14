import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PaymentFields, { blankPay, PayDraft } from './PaymentFields';

jest.mock('../../hooks/useDocSettings', () => ({ useDocSettings: () => ({ upi_id: 'shop@bank' }) }));

const Harness: React.FC<{ upiNote?: string }> = ({ upiNote }) => {
  const [v, setV] = React.useState<PayDraft>(blankPay(5000));
  return <PaymentFields value={v} onChange={setV} picks={[]} upiNote={upiNote} />;
};

test('UPI shows a QR with the amount filled in only when a note is given', () => {
  const { container, rerender } = render(<Harness upiNote="Advance Bhavin" />);
  expect(container.querySelector('.pos-upi')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
  expect(screen.getByLabelText('UPI QR code')).toBeTruthy();
  expect(screen.getByText('₹5,000')).toBeTruthy();
  rerender(<Harness />);
  expect(container.querySelector('.pos-upi')).toBeNull();
});
