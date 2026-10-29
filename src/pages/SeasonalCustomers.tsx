import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import {
  useSeasonalCustomers,
  useCreateSeasonalCustomer,
  useUpdateSeasonalCustomer,
  useDeleteSeasonalCustomer,
  SeasonalCustomer,
} from '../hooks/useSeasonalCustomers';

const emptyForm = { name: '', phone: '', address: '', notes: '' };
type FormState = typeof emptyForm;

const SeasonalCustomers: React.FC = () => {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: customers = [], isLoading } = useSeasonalCustomers();
  const createCustomer = useCreateSeasonalCustomer();
  const updateCustomer = useUpdateSeasonalCustomer();
  const deleteCustomer = useDeleteSeasonalCustomer();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (customer: SeasonalCustomer) => {
    setForm({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setEditingId(customer.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const validate = (): boolean => {
    if (!form.name.trim()) {
      toast.error('Customer name is required');
      return false;
    }
    if (form.phone && !/^\d{10}$/.test(form.phone.trim())) {
      toast.error('Phone must be exactly 10 digits');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (editingId) {
        await updateCustomer.mutateAsync({ id: editingId, ...payload });
        toast.success('Customer updated');
      } else {
        await createCustomer.mutateAsync(payload);
        toast.success('Customer added');
      }
      closeForm();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save customer');
    }
  };

  const handleDelete = async (customer: SeasonalCustomer) => {
    if (!(await confirm({ title: `Delete ${customer.name}?`, message: 'Their old bills stay; only the saved contact is removed.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteCustomer.mutateAsync(customer.id);
      toast.success('Customer deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete customer');
    }
  };

  const isPending = createCustomer.isPending || updateCustomer.isPending;

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sessional Customers</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>
            {customers.length} {customers.length === 1 ? 'customer' : 'customers'}
          </div>
        </div>
        <button style={btnPrimary} onClick={openAdd}>+ Add Customer</button>
      </div>

      <div className="page-content">
        {/* Customers table */}
        {isLoading ? (
          <div style={{ color: '#888880', fontSize: 13 }}>Loading...</div>
        ) : customers.length === 0 ? (
          <div style={{ color: '#888880', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
            No customers yet. Click "+ Add Customer" to get started.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, overflow: 'hidden' }}>
            <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                  <th style={th}>Name / Phone</th>
                  <th style={th}>Address</th>
                  <th style={th}>Notes</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: idx < customers.length - 1 ? '0.5px solid #F0F0EC' : 'none',
                    }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.phone && (
                        <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{c.phone}</div>
                      )}
                    </td>
                    <td style={{ ...td, color: c.address ? '#1A1A18' : '#BBBBBB' }}>
                      {c.address || '—'}
                    </td>
                    <td style={{ ...td, color: c.notes ? '#1A1A18' : '#BBBBBB', maxWidth: 240 }}>
                      {c.notes || '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button style={btnSm} onClick={() => openEdit(c)}>Edit</button>
                        <button
                          style={{ ...btnSm, color: '#E24B4A' }}
                          onClick={() => handleDelete(c)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showForm && (
        <Modal title={editingId ? 'Edit Customer' : 'New Customer'} onClose={closeForm} width={560}
          footer={<>
            <button style={btnGhost} onClick={closeForm}>Cancel</button>
            <button style={btnPrimary} onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : editingId ? 'Update Customer' : 'Save Customer'}
            </button>
          </>}>
          <div className="g3" style={{ marginBottom: 10 }}>
            <div>
              <label style={lbl}>Customer Name *</label>
              <input style={inp} value={form.name} autoFocus placeholder="e.g. Rajesh Patel"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Phone (10 digits)</label>
              <input style={inp} value={form.phone} placeholder="9876543210" maxLength={10} inputMode="tel"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Address</label>
              <input style={inp} value={form.address} placeholder="Area, City"
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <label style={lbl}>Notes</label>
          <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={form.notes} placeholder="Any notes about this customer"
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Modal>
      )}
      {confirmDialog}
    </div>
  );
};

const btnPrimary: React.CSSProperties = {
  background: '#1A237E', color: '#fff', border: 'none',
  padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500,
};
const btnGhost: React.CSSProperties = {
  background: 'transparent', border: '0.5px solid #D0D0CC',
  padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660',
};
const btnSm: React.CSSProperties = {
  background: '#F5F5F0', border: '0.5px solid #E5E5E0',
  padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444',
};
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', fontWeight: 500, display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = {
  border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 10px',
  fontSize: 13, background: '#fff', width: '100%', boxSizing: 'border-box',
  color: '#1A1A18',
};
const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: '#888880' };
const td: React.CSSProperties = { padding: '10px 14px' };

export default SeasonalCustomers;
