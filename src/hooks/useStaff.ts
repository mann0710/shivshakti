import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { StaffLogin } from '../types';

const KEY = ['staff'];

// People who sign in, owners first.
export const useStaffLogins = (enabled = true) =>
  useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      const rank = { owner: 0, counter: 1, kitchen: 2 };
      return (data as StaffLogin[]).sort((a, b) => rank[a.role] - rank[b.role]);
    },
  });

// Emails a one-tap sign-in link; the app then asks them to set a password.
export async function sendInvite(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } });
  if (!error) return;
  throw new Error(/signups? (are )?not allowed|disabled/i.test(error.message)
    ? 'Saved, but Supabase has new sign-ups turned off, so no email went out. Add them in Supabase › Authentication › Add user; they then use "Forgot password?" on the sign-in screen.'
    : error.message);
}

const friendly = (e: any) => new Error(/at least one owner/i.test(e?.message ?? '') ? 'Keep at least one owner who can sign in.'
  : /row-level security|permission/i.test(e?.message ?? '') ? 'Only an owner can change the team.' : e?.message || 'Could not save');

export const useSaveStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, isNew }: { row: Omit<StaffLogin, 'created_at'>; isNew: boolean }) => {
      const { error } = isNew
        ? await supabase.from('staff').insert({ ...row, email: row.email.toLowerCase() })
        : await supabase.from('staff').update({ name: row.name, mobile: row.mobile, role: row.role, can_sign_in: row.can_sign_in, invited_at: row.invited_at }).eq('email', row.email);
      if (error) throw friendly(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useRemoveStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('staff').delete().eq('email', email);
      if (error) throw friendly(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
