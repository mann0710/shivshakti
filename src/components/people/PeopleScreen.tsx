import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../ui/ConfirmDialog';
import { useUpdateBooking } from '../../hooks/useBookings';
import { NavIntent, Navigate } from '../../hooks/useNavIntent';
import { Booking } from '../../types';
import { Side, personByRecord, searchPeople } from '../../lib/people';
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

// Customers screen: one list for catering and sweets with a detail panel beside it (stacked on phones).
const PeopleScreen: React.FC<Props> = ({ onNavigate, intent, startFilter = 'all', defaultBuys, title, tabs }) => {
  const { rows, isLoading } = usePeople();
  const actions = usePersonActions();
  const updateBooking = useUpdateBooking();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(startFilter);
  const [picked, setPicked] = useState<string | null>(null);
  const [openId] = useState(intent?.action === 'open' ? intent.id : undefined);
  const [view, setView] = useState<'list' | 'detail'>(intent?.action === 'open' ? 'detail' : 'list');
  const [editing, setEditing] = useState<string | 'new' | null>(intent?.action === 'new' ? 'new' : null);
  const [combining, setCombining] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => searchPeople(rows, search).filter(p => matchesFilter(p.s, filter)), [rows, search, filter]);
  const counts = useMemo(() => filterCounts(searchPeople(rows, search).map(p => p.s)), [rows, search]);
  const twice = rows.find(p => p.twice);
  const selectedKey = picked ?? (openId ? personByRecord(rows, openId)?.key : undefined);
  const current = rows.find(p => p.key === selectedKey) ?? shown[0];
  const byKey = (k: string | null) => rows.find(p => p.key === k);

  const select = (key: string) => { setPicked(key); setView('detail'); toTop(top.current); };

  const remove = async () => {
    if (!current) return;
    const n = current.s.history.filter(h => h.kind === 'booking').length;
    const ok = await confirm({
      title: `Delete ${current.name}?`,
      message: n
        ? `${current.name} has ${n} booking${n === 1 ? '' : 's'} on record. A customer with bookings can't be deleted until those bookings are removed.`
        : 'The saved contact is removed for catering and sweets. Old bills keep the name printed on them. This cannot be undone.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await actions.remove(current);
      toast.success(`${current.name} deleted`);
      setEditing(null); setPicked(null); setView('list');
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

  const openItem = (h: HistoryItem) => (h.kind === 'booking' ? onNavigate('bookings', { action: 'open', id: h.id }) : onNavigate('seasonal_billing'));
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
          <CustomerDetail p={current} onBack={() => { setView('list'); toTop(top.current); }} onEdit={() => setEditing(current.key)} onDelete={remove}
            onCombine={() => setCombining(current.key)} onNewBooking={newBooking} onSweetsBill={() => onNavigate('seasonal_billing')}
            onMarkCompleted={markCompleted} onOpen={openItem} />
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
      {dialog}
    </div>
  );
};

export default PeopleScreen;
