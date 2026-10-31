import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import SweetsTabs from '../components/SweetsTabs';
import { Navigate } from '../hooks/useNavIntent';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
  useSeasonalOccasions, useCreateSeasonalOccasion, useDeleteSeasonalOccasion, SeasonalOccasion,
} from '../hooks/useSeasonalOccasions';
import { useSeasonalItems } from '../hooks/useSeasonalItems';
import { useSeasonalOrders } from '../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../hooks/useSeasonalPreorders';
import { seasonCount } from '../lib/occasions';
import { todayIST } from '../lib/ist';
import OccasionCard from '../components/sweets/OccasionCard';
import OccasionDialog from '../components/sweets/OccasionDialog';
import { useSeasonActions } from '../components/sweets/useSeasonActions';
import '../styles/sweets.css';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// Seasons on first, then by start date; undated ones last.
const byOrder = (a: SeasonalOccasion, b: SeasonalOccasion) =>
  Number(b.is_active) - Number(a.is_active) || (a.start_date || '9').localeCompare(b.start_date || '9') || a.name.localeCompare(b.name);

// Occasions: the festivals sweets are sold for, with dates, counts and the season switch.
const SeasonalOccasions: React.FC<{ onNavigate?: Navigate }> = ({ onNavigate }) => {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: occasions = [], isLoading } = useSeasonalOccasions();
  const { data: items = [] } = useSeasonalItems();
  const { data: orders = [] } = useSeasonalOrders();
  const { data: preorders = [] } = useSeasonalPreorders();
  const create = useCreateSeasonalOccasion();
  const del = useDeleteSeasonalOccasion();
  const season = useSeasonActions();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const today = todayIST();

  const list = useMemo(() => [...occasions].sort(byOrder), [occasions]);
  const counts = useMemo(() => new Map(occasions.map(o => [o.id, seasonCount(o, orders, preorders)])), [occasions, orders, preorders]);
  const open = occasions.find(o => o.id === editing);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) { toast.error('Type the occasion name first'); return; }
    try {
      const made = await create.mutateAsync(n);
      setName('');
      setEditing(made.id);
      toast.success(`${n} added · set its dates`);
    } catch (err) { toast.error(errorText(err)); }
  };

  const remove = async (o: SeasonalOccasion) => {
    if (!(await confirm({ title: `Delete ${o.name}?`, message: 'Its sweets become all-year sweets. End the season instead to hide them for now.', confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(o.id); setEditing(null); toast.success('Deleted'); } catch (err) { toast.error(errorText(err)); }
  };

  return (
    <div className="sw-page">
      <div className="sw-head end">
        <div>
          <h1>Occasions</h1>
          <SweetsTabs current="seasonal_occasions" onNavigate={onNavigate} />
          <span className="sw-sub">Festivals you sell sweets for · turn one on and its sweets appear on the POS</span>
        </div>
        <form className="sw-add" aria-label="Add occasion" onSubmit={add}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New occasion, e.g. Makar Sankranti" aria-label="New occasion name" />
          <button type="submit" className="ui-btn primary" disabled={create.isPending}>Add</button>
        </form>
      </div>

      {isLoading ? <div className="sw-empty">Loading…</div>
        : list.length === 0 ? <div className="sw-empty">No occasions yet. Add your first festival above.</div>
        : (
          <div className="sw-occ-grid">
            {list.map(o => (
              <OccasionCard key={o.id} o={o} today={today} busy={season.busy}
                sweets={items.filter(i => i.occasion_id === o.id)} count={counts.get(o.id) ?? { bills: 0, bookings: 0 }}
                onEdit={() => setEditing(o.id)} onSee={() => onNavigate?.('seasonal_items', { action: 'open', id: o.id })}
                onStart={() => season.start(o)} onEnd={() => season.end(o)} onDelete={() => remove(o)} />
            ))}
          </div>
        )}

      {open && <OccasionDialog key={open.id} o={open} onClose={() => setEditing(null)} onDelete={() => remove(open)} />}
      {confirmDialog}
    </div>
  );
};

export default SeasonalOccasions;
