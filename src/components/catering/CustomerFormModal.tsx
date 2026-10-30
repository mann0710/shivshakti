import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useCreateCustomer, useUpdateCustomer } from '../../hooks/useCustomers';
import { Customer } from '../../types';
import { cleanPhone, isValidPhone } from '../../lib/money';
import { cleanGstin, isValidGstin } from '../../lib/gst';
import { useHasPriceColumns } from '../../hooks/useSchemaStatus';
import { btnGhost, btnPrimary, input, label } from './CustomerUi';

interface Props { customer?: Customer; onClose: () => void; onSaved: (id: string) => void }

type Form = { name: string; phone: string; email: string; address: string; notes: string; gstin: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORM_ID = 'customer-form';

const toForm = (c?: Customer): Form => ({
  name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '', address: c?.address ?? '', notes: c?.notes ?? '', gstin: c?.gstin ?? '',
});

// One form for adding and editing a customer.
const CustomerFormModal: React.FC<Props> = ({ customer, onClose, onSaved }) => {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const [form, setForm] = useState(() => toForm(customer));
  const hasGstin = useHasPriceColumns();
  const saving = create.isPending || update.isPending;

  const bind = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const save = async () => {
    const name = form.name.trim();
    if (!name) { toast.error('Name is required'); return; }
    if (form.phone.trim() && !isValidPhone(form.phone)) { toast.error('Enter a valid 10-digit mobile number'); return; }
    if (form.email && !EMAIL_RE.test(form.email)) { toast.error('Enter a valid email address'); return; }
    if (form.gstin.trim() && !isValidGstin(form.gstin)) { toast.error('Enter a valid 15-character GSTIN'); return; }
    const { gstin, ...rest } = form;
    const payload = {
      ...rest, name, phone: form.phone.trim() ? cleanPhone(form.phone) : '',
      ...(hasGstin ? { gstin: gstin.trim() ? cleanGstin(gstin) : null } : {}),
    };
    try {
      const saved: Customer = customer
        ? await update.mutateAsync({ id: customer.id, ...payload })
        : await create.mutateAsync(payload);
      toast.success(customer ? 'Customer updated!' : 'Customer added!');
      onSaved(saved?.id ?? customer?.id ?? '');
    } catch (e: any) { toast.error(e?.message || `Failed to ${customer ? 'update' : 'add'} customer`); }
  };

  return (
    <Modal title={customer ? 'Edit customer' : 'New customer'} onClose={onClose} width={520}
      footer={<>
        <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
        <button type="submit" form={FORM_ID} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} disabled={saving}>
          {saving ? 'Saving...' : customer ? 'Update Customer' : 'Save Customer'}
        </button>
      </>}>
      <form id={FORM_ID} onSubmit={e => { e.preventDefault(); save(); }}>
        <div style={{ marginBottom: 10 }}>
          <label style={label}>Full name *</label>
          <input style={input} autoFocus placeholder="e.g. Rajesh Patel" {...bind('name')} />
        </div>
        <div className="g2" style={{ marginBottom: 10, gap: 10 }}>
          <div><label style={label}>Mobile</label><input type="tel" inputMode="tel" maxLength={16} style={input} placeholder="98765 43210" {...bind('phone')} /></div>
          <div><label style={label}>Email</label><input type="email" style={input} placeholder="customer@example.com" {...bind('email')} /></div>
        </div>
        <div className={hasGstin ? 'g2' : undefined} style={{ marginBottom: 10, gap: 10 }}>
          <div><label style={label}>Address</label><input style={input} placeholder="Area, City" {...bind('address')} /></div>
          {hasGstin && <div><label style={label}>GSTIN (for business bills)</label>
            <input style={{ ...input, textTransform: 'uppercase' }} maxLength={15} placeholder="24ABCDE1234F1Z5" {...bind('gstin')} /></div>}
        </div>
        <div>
          <label style={label}>Notes</label>
          <textarea rows={2} style={{ ...input, resize: 'vertical' }} placeholder="Any notes about this customer" {...bind('notes')} />
        </div>
      </form>
    </Modal>
  );
};

export default CustomerFormModal;
