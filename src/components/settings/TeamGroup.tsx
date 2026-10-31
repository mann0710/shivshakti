import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StaffLogin, TeamMember } from '../../types';
import { ROLES } from '../navItems';
import { useTeamMembers } from '../../hooks/useDataCenter';
import { useStaffLogins } from '../../hooks/useStaff';
import { useHasTeamBin, TEAM_BIN_MIGRATION_FILE } from '../../hooks/useSchemaStatus';
import { formatPhone } from '../../lib/people';
import { LinkBtn, Notice, Panel, Row } from './SettingsUi';
import { TeamMemberDialog } from './SettingsDialogs';
import { TeamLoginDialog } from './TeamDialogs';
import SetPasswordDialog from './SetPasswordDialog';

const roleOf = (l: StaffLogin) => ROLES.find(r => r.id === l.role) ?? ROLES[0];

// Who signs in and what they see, then the team list used for events (no sign-in).
const TeamGroup: React.FC = () => {
  const ready = useHasTeamBin();
  const { data: logins = [] } = useStaffLogins(ready);
  const { data: members = [] } = useTeamMembers();
  const [me, setMe] = useState('');
  const [login, setLogin] = useState<StaffLogin | 'new' | null>(null);
  const [member, setMember] = useState<TeamMember | 'new' | null>(null);
  const [password, setPassword] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.email ?? '')); }, []);
  const isMe = (l: StaffLogin) => l.email.toLowerCase() === me.toLowerCase();

  return (
    <Panel id="team" title="Team & access" sub="Who can sign in and what they see.">
      {!ready && <Notice>Run <code>{TEAM_BIN_MIGRATION_FILE}</code> in Supabase → SQL Editor to invite people and give them roles.</Notice>}
      <div className="st-rows">
        {logins.map(l => (
          <button key={l.email} type="button" className="st-row st-row-btn" onClick={() => setLogin(l)}>
            <span className="st-row-main">
              <span>{l.name || l.email}{isMe(l) ? ' (you)' : ''}</span>
              <small className={l.can_sign_in ? '' : 'warn'}>{[l.name ? l.email : '', l.can_sign_in ? roleOf(l).note : 'Can not sign in'].filter(Boolean).join(' · ')}</small>
            </span>
            <span className="st-row-end"><span className="st-value">{roleOf(l).label}</span></span>
          </button>
        ))}
        {!ready && me && <Row label={me} note="Signed in now on this device"><span className="st-value">You</span></Row>}
        {ready && <Row label="Add someone" note="By email · they get a sign-in link"><LinkBtn onClick={() => setLogin('new')}>Invite</LinkBtn></Row>}
        <Row label="Your password" note="The one you sign in with on any device"><LinkBtn onClick={() => setPassword(true)}>Change</LinkBtn></Row>
      </div>
      <div className="st-block">
        <span className="st-block-label">Team list for events · {members.length} {members.length === 1 ? 'person' : 'people'}</span>
        <small className="st-block-note">Cooks and helpers, no sign-in. Tap someone to edit.</small>
        <div className="st-rows">
          {members.map(m => (
            <button key={m.id} type="button" className="st-row st-row-btn" onClick={() => setMember(m)}>
              <span className="st-row-main"><span>{m.name}</span><small>{[m.mobile && formatPhone(m.mobile), m.email].filter(Boolean).join(' · ') || 'No contact saved'}</small></span>
              <span className="st-row-end"><span className="st-link">Edit</span></span>
            </button>
          ))}
        </div>
        <LinkBtn onClick={() => setMember('new')}>+ Add a person</LinkBtn>
      </div>
      {login && ready && <TeamLoginDialog login={login === 'new' ? undefined : login} me={me} onClose={() => setLogin(null)} />}
      {member && <TeamMemberDialog member={member === 'new' ? undefined : member} onClose={() => setMember(null)} />}
      {password && <SetPasswordDialog email={me} onClose={() => setPassword(false)} />}
    </Panel>
  );
};

export default TeamGroup;
