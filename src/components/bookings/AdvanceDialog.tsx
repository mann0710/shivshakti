import React, { useId, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Booking } from '../../types';
import { useUpdateBooking } from '../../hooks/useBookings';
import { todayIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { Chips, DialogFoot, Field, Group, inputClass } from './FormBits';
import { PAY_MODES } from './eventFacts';

interface Props { booking: Booking; suggested?: number; onClose: () => void }

// Advance taken before the invoice; it is saved on the booking and filled in on the invoice.
const AdvanceDialog: React.FC<Props> = ({ booking: b, suggested, onClose }) => {
  const id = useId();
  const update = useUpdateBooking();
  const had = Number(b.advance_received) || 0;
  const [amount, setAmount] = useState(had ? String(had) : '');
  const [mode, setMode] = useState(b.advance_mode || 'cash');
  const [date, setDate] = useState(b.advance_date || todayIST());
  const [bad, setBad] = useState('');
  const modeName = PAY_MODES.find(([k]) => k === mode)?.[1] ?? 'Cash';
  const dirty = amount !== (had ? String(had) : '') || mode !== (b.advance_mode || 'cash');

  const save = async () => {
    const n = parseFloat(amount);
    if (!(n >= 0) || amount.trim() === '') { setBad('Type the amount received'); return; }
    try {
      await update.mutateAsync({ id: b.id, advance_received: n, advance_mode: n ? mode : null, advance_date: n ? date : null });
      toast.success(n ? `Advance of ${inr(n)} saved` : 'Advance cleared');
      onClose();
    } catch (e: any) { toast.error(e?.message || 'Could not save the advance'); }
  };

  return (
    <Modal title="Record advance" onClose={onClose} width={420} dirty={dirty} busy={update.isPending}
      footer={<DialogFoot label="Save advance" busy={update.isPending} onSave={save} />}>
      <div className="bkf">
        <p className="bkf-sub">{b.customer?.name ?? 'Customer'} · {b.event_type}. The new invoice fills this advance in by itself.</p>
        <Group>
          <Field label="Amount received" htmlFor={`${id}-amt`} error={bad} full
            hint={suggested ? `Ask about ${inr(suggested)} to confirm the date` : undefined}>
            <input id={`${id}-amt`} type="number" inputMode="decimal" min={0} className={inputClass(bad, true)} value={amount}
              placeholder="₹" onChange={e => { setAmount(e.target.value); setBad(''); }} />
          </Field>
          <Chips label="Paid by" options={PAY_MODES.map(([, t]) => t)} value={modeName} full
            onPick={t => setMode(PAY_MODES.find(([, name]) => name === t)?.[0] ?? 'cash')} />
          <Field label="Date" htmlFor={`${id}-date`}>
            <input id={`${id}-date`} type="date" className="bkf-input" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} />
          </Field>
        </Group>
      </div>
    </Modal>
  );
};

export default AdvanceDialog;
