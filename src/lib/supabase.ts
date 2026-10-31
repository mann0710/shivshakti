import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL!;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY!;

// The email link this page was opened from ("magiclink", "recovery", "invite", "signup"), read before the auth client clears the address.
export const emailLinkType = typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
export const fromAuthLink = typeof window !== 'undefined' && /access_token=|error_description=/.test(window.location.hash);

export const supabase = createClient(url, key);
