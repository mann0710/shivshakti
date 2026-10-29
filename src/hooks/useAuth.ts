import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Access = 'checking' | 'signed_out' | 'not_staff' | 'staff';

// Session plus whether the signed-in email is on the staff list.
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [staff, setStaff] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setStaff(null); return; }
    let live = true;
    supabase.rpc('is_staff').then(({ data, error }) => {
      // Before the security migration the function doesn't exist yet; let the user in.
      if (live) setStaff(error ? true : data === true);
    });
    return () => { live = false; };
  }, [session]);

  const access: Access = session === undefined || (session && staff === null)
    ? 'checking'
    : !session ? 'signed_out' : staff ? 'staff' : 'not_staff';

  return { access, email: session?.user.email ?? '', signOut: () => supabase.auth.signOut() };
}
