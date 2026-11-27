import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../ui/ConfirmDialog';
import Modal from '../ui/Modal';
import { posLink } from '../../lib/posIntent';
import { useUpdateBooking } from '../../hooks/useBookings';
import { NavIntent, Navigate } from '../../hooks/useNavIntent';
import { useRecordRoute } from '../../hooks/useRoute';
import type { Page } from '../navItems';
import { Booking } from '../../types';
import { Person, Side, personByRecord, searchPeople } from '../../lib/people';
import { Filter, HistoryItem, filterCounts, matchesFilter } from '../../lib/personHistory';
import { undoToast } from '../pos/undoToast';
import CustomerDetail from '../catering/CustomerDetail';
import CustomerFormModal from '../catering/CustomerFormModal';
import PeopleList from './PeopleList';
import CombineDialog from './CombineDialog';
import { usePeople } from './usePeople';
import { usePersonActions } from './usePersonActions';
import '../../styles/people.css';

interface Props {
  page: Page;
  onNavigate: Navigate;
  intent?: NavIntent | null;
  startFilter?: Filter;
  defaultBuys?: Side[];
  title: string;
  tabs?: React.ReactNode;
}

const isPhone = () => window.matchMedia('(max-width: 768px)').matches;
// Phones swap the list for the detail, so start the new view at the top.
const toTop = (el: HTMLElement | null) => { if (isPhone()) requestAnimationFrame(() => el?.scrollIntoView({ block: 'start' })); };
// Links carry a record id, never the person key (a mobile number).
const linkId = (p: Person) => p.catering[0]?.id ?? p.sweets[0]?.id;

// Customers screen: one list for catering and sweets with a detail panel beside it (stacked on phones).
const PeopleScreen: React.FC<Props> = ({ page, onNavigate, intent, startFilter = 'all', defaultBuys, title, tabs }) => {
  const { rows, isLoading } = usePeople();
  const actions = usePersonActions();
  const updateBooking = useUpdateBooking();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(startFilter);
  // The open customer lives in the address (/customers/<record id>); phones show the detail while one is open.
  const route = useRecordRoute(page);
  // A person saved just now opens once the list has them.
  const pending = useRef<string | null>(null);
  const view = route.id ? 'detail' : 'list';
  const [editing, setEditing] = useState<string | 'new' | null>(intent?.action === 'new' ? 'new' : null);
  const [combining, setCombining] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => searchPeople(rows, search).filter(p => matchesFilter(p.s, filter)), [rows, search, filter]);
  const counts = useMemo(() => filterCounts(searchPeople(rows, search).map(p => p.s)), [rows, search]);
  const twice = rows.find(p => p.twice);
  const selectedKey = route.id ? personByRecord(rows, route.id)?.key : undefined;
  const current = rows.find(p => p.key === selectedKey) ?? shown[0];
  const byKey = (k: string | null) => rows.find(p => p.key === k);

  const select = (key: string) => {
    const p = byKey(key);
    if (p) route.open(linkId(p)); else pending.current = key;
    toTop(top.current);
  };
  useEffect(() => {
    const p = byKey(pending.current);
    if (p) { pending.current = null; route.open(linkId(p)); }
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async () => {
    if (!current) return;
    const n = current.s.history.filter(h => h.kind === 'booking').length;
    // Bookings block the delete, so only explain it.
    if (n) return setBlocked(`${current.name} has ${n} booking${n === 1 ? '' : 's'} on record. A customer with bookings can't be deleted until those bookings are removed.`);
    const ok = await confirm({
      title: `Delete ${current.name}?`,
      message: 'The saved contact is removed for catering and sweets. Old bills keep the name printed on them. It stays in Settings › Data › Recycle bin for 30 days.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await actions.remove(current);
      toast.success(`${current.name} deleted`);
      setEditing(null); route.open(undefined, true);
    } catch (e: any) {
      toast.error(e?.code === '23503' ? "Can't delete: this customer still has bookings or quotations" : e?.message || 'Could not delete');
    }
  };

  const newBooking = async () => {
    if (!current) return;
    try { onNavigate('bookings', { action: 'new', id: await actions.cateringId(current) }); }
    catch (e: any) { toast.error(e?.message || 'Could not start a booking'); }
  };

  const markCompleted = async (b: Booking) => {
    try {
      await updateBooking.mutateAsync({ id: b.id, status: 'completed' });
      undoToast(`${b.event_type} marked completed`, () => { updateBooking.mutate({ id: b.id, status: 'confirmed' }); });
    } catch (e: any) { toast.error(e?.message || 'Could not update the booking'); }
  };

  const who = current && { name: current.name, phone: current.phone };
  const openItem = (h: HistoryItem) => (h.kind === 'booking' ? onNavigate('bookings', { action: 'open', id: h.id })
    : onNavigate('seasonal_billing', h.kind === 'bill' ? posLink.bills(who) : posLink.preorders(h.id, who)));
  const editingPerson = editing && editing !== 'new' ? byKey(editing) : undefined;
  const combinePerson = byKey(combining);

  return (
    <div className="pp-page" data-view={view} ref={top}>
      <div className="pp-head">
        <div>
          <h1>{title}</h1>
          <p>{rows.length} {rows.length === 1 ? 'person' : 'people'} · catering and sweets in one list</p>
          {tabs}
        </div>
        <button type="button" className="ui-btn primary" aria-label="New customer" onClick={() => setEditing('new')}>+ New<span className="only-desktop-inline"> customer</span></button>
      </div>

      <div className="pp-layout">
        <PeopleList rows={shown} counts={counts} filter={filter} search={search} selected={current?.key} twice={twice} loading={isLoading}
          onFilter={setFilter} onSearch={setSearch} onSelect={select} onCombine={p => setCombining(p.key)} />
        {current ? (
          <CustomerDetail p={current} onBack={() => { route.close(); toTop(top.current); }} onEdit={() => setEditing(current.key)} onDelete={remove}
            onCombine={() => setCombining(current.key)} onNewBooking={newBooking} onSweetsBill={() => onNavigate('seasonal_billing', posLink.bill(who))}
            onMarkCompleted={markCompleted} onOpen={openItem}
            onCredit={() => onNavigate('seasonal_billing', posLink.credit(who))} />
        ) : (
          <section className="pp-detail"><div className="pp-placeholder">{isLoading ? 'Loading…' : 'Pick a customer to see their bookings and bills.'}</div></section>
        )}
      </div>

      {editing && (editing === 'new' || editingPerson) && (
        <CustomerFormModal person={editingPerson} people={rows} defaultBuys={defaultBuys}
          onClose={() => setEditing(null)} onDelete={remove}
          onSaved={key => { setEditing(null); if (key) select(key); }}
          onOpen={key => { setEditing(null); select(key); }} />
      )}
      {combinePerson && <CombineDialog person={combinePerson} onClose={() => setCombining(null)} />}
      {blocked && (
        <Modal title="Can't delete this customer" onClose={() => setBlocked(null)} width={400}
          footer={<button type="button" className="ui-btn primary" onClick={() => setBlocked(null)}>OK</button>}>
          <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{blocked}</p>
        </Modal>
      )}
      {dialog}
    </div>
  );
};

export default PeopleScreen;
