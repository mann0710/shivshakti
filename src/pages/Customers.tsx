import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useCustomers, useDeleteCustomer } from '../hooks/useCustomers';
import { useBookings } from '../hooks/useBookings';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { Booking, Customer } from '../types';
import CustomerFormModal from '../components/catering/CustomerFormModal';
import CustomerDetail from '../components/catering/CustomerDetail';
import { Avatar, ORANGE, btnPrimary, card, input, revealOnPhone } from '../components/catering/CustomerUi';

interface Props { onNavigate: Navigate; }

const NO_BOOKINGS: Booking[] = [];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const Customers: React.FC<Props> = ({ onNavigate }) => {
  const intent = useNavIntent('customers');
  const { data: customers = [], isLoading } = useCustomers();
  const { data: bookings = [] } = useBookings();
  const deleteCustomer = useDeleteCustomer();
  const { confirm, dialog } = useConfirm();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(intent?.action === 'open' ? intent.id ?? null : null);
  const [editing, setEditing] = useState<Customer | 'new' | null>(intent?.action === 'new' ? 'new' : null);
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const bookingsByCustomer = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(b => map.set(b.customer_id, [...(map.get(b.customer_id) ?? []), b]));
    return map;
  }, [bookings]);
  const bookingsOf = (id?: string) => (id && bookingsByCustomer.get(id)) || NO_BOOKINGS;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    if (!term) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits))
    );
  }, [customers, search]);

  const current = customers.find(c => c.id === selected) || filtered[0];

  const select = (id: string) => { setSelected(id); revealOnPhone(detailRef); };

  const handleDelete = async () => {
    if (!current) return;
    const n = bookingsOf(current.id).length;
    const ok = await confirm({
      title: `Delete ${current.name}?`,
      message: n
        ? `${current.name} has ${plural(n, 'booking')} on record. A customer with bookings can't be deleted until those bookings are removed.`
        : 'This customer will be removed permanently. This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await deleteCustomer.mutateAsync(current.id);
      toast.success('Customer deleted');
      setSelected(null);
    } catch (e: any) {
      toast.error(e?.code === '23503' ? "Can't delete: this customer still has bookings or quotations" : e?.message || 'Failed to delete customer');
    }
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Customers</div>
        <div style={{ display: 'flex', gap: 10, flex: '1 1 320px', justifyContent: 'flex-end' }}>
          <input type="search" style={{ ...input, flex: '1 1 160px', maxWidth: 280, minWidth: 0 }}
            placeholder="Search name, phone or email" value={search} onChange={e => setSearch(e.target.value)} />
          <button type="button" style={{ ...btnPrimary, flexShrink: 0 }} onClick={() => setEditing('new')}>+ Add Customer</button>
        </div>
      </div>
      <div className="page-content">
        <div className="g-customer">
          <div ref={listRef}>
            <div style={{ fontSize: 11, color: '#888880', marginBottom: 8, fontWeight: 500 }}>{plural(filtered.length, 'customer')}</div>
            {isLoading && <div style={{ color: '#888880', fontSize: 12 }}>Loading...</div>}
            {!isLoading && filtered.length === 0 && (
              <div style={{ color: '#888880', fontSize: 12, padding: '12px 0' }}>
                {search ? `No customers match "${search}".` : 'No customers yet. Add your first one.'}
              </div>
            )}
            {filtered.map(c => {
              const active = current?.id === c.id;
              return (
                <button key={c.id} type="button" onClick={() => select(c.id)}
                  style={{ ...card, ...listItem, border: `0.5px solid ${active ? ORANGE : '#E5E5E0'}`, background: active ? '#FFFBF5' : '#FFFFFF' }}>
                  <Avatar name={c.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>{c.phone ? `${c.phone} · ` : ''}{plural(bookingsOf(c.id).length, 'booking')}</div>
                  </div>
                  <span style={{ color: '#BBBBBB', fontSize: 16 }}>›</span>
                </button>
              );
            })}
          </div>

          <div ref={detailRef}>
            {current ? (
              <CustomerDetail
                customer={current}
                bookings={bookingsOf(current.id)}
                onEdit={() => setEditing(current)}
                onDelete={handleDelete}
                onBack={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                onNavigate={onNavigate}
              />
            ) : (
              <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 13, minHeight: 120 }}>
                Select a customer to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <CustomerFormModal
          customer={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={id => { setEditing(null); if (id) select(id); }}
        />
      )}
      {dialog}
    </div>
  );
};

const listItem: React.CSSProperties = { width: '100%', padding: '10px 12px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', color: 'inherit' };

export default Customers;
