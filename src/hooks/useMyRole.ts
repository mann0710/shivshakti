import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useRole } from './useRole';

// The signed-in role (from App) plus the email, for "who did it" on credit entries.
export function useMyRole() {
  const role = useRole();
  const { data: email = '' } = useQuery({
    queryKey: ['my_email'],
    staleTime: Infinity,
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user.email ?? '',
  });
  return { role, email, isOwner: role === 'owner' };
}
