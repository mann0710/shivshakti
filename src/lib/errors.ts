// Supabase returns plain { message, code } objects, not Error, so read the message from either.
export function errorText(e: unknown, fallback = 'Could not save'): string {
  const message = typeof e === 'object' && e !== null ? (e as { message?: unknown }).message : undefined;
  return typeof message === 'string' && message ? message : fallback;
}

// Postgres check_violation on a status column: the database still has an older list of statuses.
export const isStatusCheck = (e: unknown) => {
  const { code, message } = (typeof e === 'object' && e !== null ? e : {}) as { code?: string; message?: string };
  return code === '23514' && /status/i.test(message ?? '');
};
