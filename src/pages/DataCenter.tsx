import React, { useMemo, useRef, useState } from 'react';
import { useEventTypes, useTeamMembers } from '../hooks/useDataCenter';
import { GROUPS, GroupId, groupNotes, searchSettings } from '../lib/settingsIndex';
import { useSettingsSave } from '../components/settings/useSettingsSave';
import BusinessGroup from '../components/settings/BusinessGroup';
import MoneyGroup from '../components/settings/MoneyGroup';
import DocSettingsCard from '../components/DocSettingsCard';
import CateringGroup from '../components/settings/CateringGroup';
import SweetsGroup, { useUndatedOccasions } from '../components/settings/SweetsGroup';
import RemindersGroup from '../components/settings/RemindersGroup';
import TeamGroup from '../components/settings/TeamGroup';
import DataGroup, { useDbUpdates } from '../components/settings/DataGroup';
import DeviceGroup from '../components/settings/DeviceGroup';
import { readTextSize } from '../lib/textSize';
import { useStaffLogins } from '../hooks/useStaff';
import { useHasTeamBin } from '../hooks/useSchemaStatus';
import { backupStale } from '../lib/backup';
import ImportScreen from '../components/data/ImportScreen';
import '../styles/settings.css';
import '../styles/settings-data.css';

// Settings in nine groups; each change saves by itself with Undo (text size is per device).
const DataCenter: React.FC = () => {
  const api = useSettingsSave();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: team = [] } = useTeamMembers();
  const undated = useUndatedOccasions();
  const db = useDbUpdates();
  const { data: logins = [] } = useStaffLogins(useHasTeamBin());
  const [importing, setImporting] = useState(false);
  const [group, setGroup] = useState<GroupId>('business');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [textSize, setTextSize] = useState(readTextSize);
  const top = useRef<HTMLDivElement>(null);

  const notes = groupNotes({
    gstNumber: api.dc?.gst_number || '', gstRate: Number(api.dc?.gst_rate ?? 18), upiId: api.docs.upi_id, address: api.docs.address,
    fssai: !!api.dc?.fssai_certificate_url, docsReady: api.docsReady, eventTypes: eventTypes.length, teamMembers: team.length, logins: logins.length,
    undated, updates: db.pending.length, reminders: Object.values(api.docs.reminders).filter(r => r.on).length, backupStale: backupStale(api.docs.last_backup_at),
    textSize,
  });
  const hits = useMemo(() => searchSettings(query), [query]);
  const searching = query.trim().length > 0;
  const shown = searching ? GROUPS.filter(g => hits.has(g.id)) : GROUPS;
  const active = searching && !hits.has(group) ? shown[0]?.id : group;

  const open = (id: GroupId) => { setGroup(id); setPhoneOpen(true); requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' })); };

  const panel = (id?: GroupId) => {
    switch (id) {
      case 'business': return <BusinessGroup api={api} />;
      case 'money': return <MoneyGroup api={api} />;
      case 'documents': return <DocSettingsCard api={api} />;
      case 'catering': return <CateringGroup />;
      case 'sweets': return <SweetsGroup />;
      case 'reminders': return <RemindersGroup api={api} />;
      case 'team': return <TeamGroup />;
      case 'data': return <DataGroup api={api} onImport={() => setImporting(true)} />;
      case 'device': return <DeviceGroup size={textSize} onSize={setTextSize} />;
      default: return <div className="st-panel st-empty">No setting matches "{query}". Try "UPI" or "GST".</div>;
    }
  };

  if (importing) return <ImportScreen kind="dishes" crumb="Settings" onClose={() => setImporting(false)} />;

  return (
    <div className="st-page" data-view={phoneOpen ? 'group' : 'list'} ref={top}>
      <div className="st-head">
        <div><h1>Settings</h1><p>Each change saves by itself</p></div>
        <label className="st-search">
          <span className="st-sr">Search settings</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B66" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="search" placeholder='Search settings — try "UPI" or "GST"' value={query} onChange={e => { setQuery(e.target.value); setPhoneOpen(false); }} />
        </label>
      </div>

      <div className="st-layout">
        <nav className="st-groups" aria-label="Settings groups">
          {shown.map(g => (
            <button key={g.id} type="button" className={`st-group${g.id === active ? ' on' : ''}`} aria-current={g.id === active ? 'true' : undefined} onClick={() => open(g.id)}>
              <span><b>{g.title}</b><small className={!searching && notes[g.id].warn ? 'warn' : ''}>{searching ? hits.get(g.id)!.join(' · ') : notes[g.id].note}</small></span>
              <i aria-hidden="true">›</i>
            </button>
          ))}
          {!shown.length && <p className="st-empty">Nothing matches "{query}".</p>}
        </nav>
        <div className="st-main">
          <button type="button" className="st-back" onClick={() => setPhoneOpen(false)}>‹ Settings</button>
          {panel(active)}
        </div>
      </div>

      {api.last && (
        <div className="st-bar" role="status">
          <span>Each change saves by itself. <b>{api.last.label}</b> saved just now.</span>
          <button type="button" className="ui-btn" onClick={api.last.undo}>Undo</button>
          <button type="button" className="ui-btn primary" onClick={api.clearLast}>Done</button>
        </div>
      )}
    </div>
  );
};

export default DataCenter;
