import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { emailLinkType, supabase } from '../lib/supabase';
import type { Role } from '../components/navItems';

export type Access = 'checking' | 'signed_out' | 'not_staff' | 'staff';

const ROLES: Role[] = ['owner', 'counter', 'kitchen'];

// Session, whether the signed-in email is on the staff list, and its role.
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  // Invite, magic-link and reset links sign the person in; they then set a password.
  const [needsPassword, setNeedsPassword] = useState(['magiclink', 'recovery', 'invite', 'signup'].includes(emailLinkType ?? ''));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setRole(undefined); return; }
    let live = true;
    supabase.rpc('my_role').then(async ({ data, error }) => {
      if (!live) return;
      if (!error) { setRole(ROLES.includes(data) ? data : null); return; }
      // Before the team migration there are no roles: staff are owners; before the security migration everyone is.
      const staff = await supabase.rpc('is_staff');
      if (live) setRole(staff.error || staff.data === true ? 'owner' : null);
    });
    return () => { live = false; };
  }, [session]);

  const access: Access = session === undefined || (session && role === undefined)
    ? 'checking'
    : !session ? 'signed_out' : role ? 'staff' : 'not_staff';

  return {
    access, role: role ?? 'owner', email: session?.user.email ?? '',
    needsPassword, passwordSet: () => setNeedsPassword(false),
    signOut: () => supabase.auth.signOut(),
  };
}
