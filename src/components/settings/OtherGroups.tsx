import React, { useEffect, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { TeamMember } from '../../types';
import { useTeamMembers } from '../../hooks/useDataCenter';
import {
  useHasDocSettings, useHasPreorderColumns, useHasPriceColumns, useHasQuoteOptions, useIsLegacySchema,
  DOC_SETTINGS_MIGRATION_FILE, PACK_MIGRATION_FILE, PREORDER_MIGRATION_FILE, PRICE_MIGRATION_FILE, QUOTE_OPTIONS_MIGRATION_FILE,
} from '../../hooks/useSchemaStatus';
import { useHasPosPayments, POS_MIGRATION_FILE } from '../../hooks/useSeasonalOrders';
import { formatPhone } from '../../lib/people';
import { LinkBtn, Panel, Row, Soon } from './SettingsUi';
import { TeamMemberDialog } from './SettingsDialogs';

// Database updates the app is waiting for, by migration file.
export function useDbUpdates() {
  const checks: [boolean, string][] = [
    [!useIsLegacySchema(), PACK_MIGRATION_FILE],
    [useHasPriceColumns(), PRICE_MIGRATION_FILE],
    [useHasPreorderColumns(), PREORDER_MIGRATION_FILE],
    [useHasDocSettings(), DOC_SETTINGS_MIGRATION_FILE],
    [useHasQuoteOptions(), QUOTE_OPTIONS_MIGRATION_FILE],
    [useHasPosPayments(), POS_MIGRATION_FILE],
  ];
  const checking = useIsFetching({ queryKey: ['schema_status'] }) > 0;
  return { checking, pending: checking ? [] : checks.filter(([ok]) => !ok).map(([, file]) => file) };
}

export const RemindersGroup: React.FC = () => (
  <Panel id="reminders" title="Reminders on Home" sub="One tap sends each on WhatsApp.">
    <p className="st-sub">Home already lists what needs you today. Choosing when each reminder shows is coming soon.</p>
    <div className="st-rows">
      <Soon label="Payment due" note="From the payment plan" />
      <Soon label="Quote with no reply" />
      <Soon label="Pre-booking pickup" />
      <Soon label="Unpaid sweets bill" />
    </div>
  </Panel>
);

// Who is signed in, and the team list used for events.
export const TeamGroup: React.FC = () => {
  const { data: members = [] } = useTeamMembers();
  const [email, setEmail] = useState('');
  const [open, setOpen] = useState<TeamMember | 'new' | null>(null);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? '')); }, []);

  return (
    <Panel id="team" title="Team & access" sub="Who can sign in and what they see.">
      <div className="st-rows">
        {email && <Row label={email} note="Signed in now on this device"><span className="st-value">You</span></Row>}
        <Soon label="Add someone" note="Today the owner adds their email in Supabase (table staff)" />
      </div>
      <div className="st-block">
        <span className="st-block-label">Team list for events · {members.length} {members.length === 1 ? 'person' : 'people'}</span>
        <small className="st-block-note">Cooks and helpers, no sign-in. Tap someone to edit.</small>
        <div className="st-rows">
          {members.map(m => (
            <button key={m.id} type="button" className="st-row st-row-btn" onClick={() => setOpen(m)}>
              <span className="st-row-main"><span>{m.name}</span><small>{[m.mobile && formatPhone(m.mobile), m.email].filter(Boolean).join(' · ') || 'No contact saved'}</small></span>
              <span className="st-row-end"><span className="st-link">Edit</span></span>
            </button>
          ))}
        </div>
        <LinkBtn onClick={() => setOpen('new')}>+ Add a person</LinkBtn>
      </div>
      {open && <TeamMemberDialog member={open === 'new' ? undefined : open} onClose={() => setOpen(null)} />}
    </Panel>
  );
};

export const DataGroup: React.FC = () => {
  const { checking, pending } = useDbUpdates();
  return (
    <Panel id="data" title="Data" sub="Get data in and out, keep it safe.">
      <div className="st-rows">
        <Row label="Database updates" warn={pending.length > 0}
          note={pending.length ? `Run in Supabase → SQL Editor: ${pending.join(', ')}` : 'New features that need the database are switched on'}>
          <span className={`st-value${pending.length ? ' warn' : ''}`}>{checking ? 'Checking…' : pending.length ? `${pending.length} to run` : 'Up to date'}</span>
        </Row>
        <Soon label="Import from Excel" note="Dishes, sweets, customers" />
        <Soon label="Download everything" note="One file, a sheet per list" />
        <Soon label="Backup copy" note="Keep one each week" />
        <Soon label="Recycle bin" note="Deleted things stay 30 days" />
      </div>
    </Panel>
  );
};
