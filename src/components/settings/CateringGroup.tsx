import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EventType } from '../../types';
import { useBookings } from '../../hooks/useBookings';
import { useEventTypes, useCreateEventType, DEFAULT_EVENTS } from '../../hooks/useDataCenter';
import { Panel, Row, Soon } from './SettingsUi';
import { EventTypeDialog } from './SettingsDialogs';

// Event types offered in bookings (tap one to rename or remove) and the fixed food styles.
const CateringGroup: React.FC = () => {
  const { data: types = [], isSuccess } = useEventTypes();
  const { data: bookings = [] } = useBookings();
  const create = useCreateEventType();
  const seeded = useRef(false);
  const [open, setOpen] = useState<EventType | 'new' | null>(null);

  // A brand-new shop starts with the usual event types.
  useEffect(() => {
    if (!isSuccess || types.length || seeded.current) return;
    seeded.current = true;
    DEFAULT_EVENTS.forEach(name => create.mutate(name, { onError: () => {} }));
  }, [isSuccess, types.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const used = useMemo(() => {
    const m = new Map<string, number>();
    bookings.forEach(b => m.set(b.event_type, (m.get(b.event_type) ?? 0) + 1));
    return m;
  }, [bookings]);

  return (
    <Panel id="catering" title="Catering" sub="Choices offered in bookings and quotes.">
      <div className="st-block">
        <span className="st-block-label">Event types · {types.length}</span>
        <small className="st-block-note">Tap one to rename or remove it.</small>
        <div className="st-chipset">
          {types.map(t => (
            <button key={t.id} type="button" className="st-chip" onClick={() => setOpen(t)}>
              {t.name}{used.get(t.name) ? <small>{used.get(t.name)}</small> : null}
            </button>
          ))}
          <button type="button" className="st-chip add" onClick={() => setOpen('new')}>+ New event type</button>
        </div>
      </div>
      <div className="st-rows">
        <Row label="Food styles" note="Regular · Jain · Swaminarayan · fixed for now"><b>3</b></Row>
        <Soon label="Dish tags" note="No onion-garlic, Jain, spicy…" />
        <Soon label="Courses and their order" note="Sweet, Farsan, Main course…" />
      </div>
      {open && (
        <EventTypeDialog type={open === 'new' ? undefined : open} usedBy={open === 'new' ? 0 : used.get(open.name) ?? 0}
          names={types.map(t => t.name)} onClose={() => setOpen(null)} />
      )}
    </Panel>
  );
};

export default CateringGroup;
