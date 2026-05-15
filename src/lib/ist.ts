import { format } from 'date-fns';

export const getISTGreeting = (): string => {
  const hour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// Returns today's date as YYYY-MM-DD in IST
export const todayIST = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Formats a stored ISO/date string for display using IST locale
export const formatDateTimeIST = (isoStr: string | undefined): string => {
  if (!isoStr) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoStr));
  } catch {
    return isoStr;
  }
};

// Formats a date-only string (YYYY-MM-DD) using date-fns format string
export const formatDateIST = (dateStr: string | undefined, fmt: string): string => {
  if (!dateStr) return '—';
  try {
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return format(d, fmt);
  } catch {
    return '—';
  }
};
