import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { Booking } from '../types';

export const useBookings = () =>
  useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      return fetchAll<Booking>((from, to) => supabase
        .from('bookings').select('*, customer:customers(*), menu:menus(*)')
        .order('event_date', { ascending: true }).range(from, to));
    },
  });

type Slot = Pick<Booking, 'venue' | 'event_date' | 'end_date' | 'status'>;

// Same named venue on overlapping dates (multi-day included) is a clash; blank venues and cancelled bookings are not.
const FINAL = ['confirmed', 'completed'];

// Only confirmed events hold a venue; enquiries and quotes may overlap (the quote form warns instead).
const assertVenueFree = async (b: Partial<Slot>, ignoreId?: string) => {
  const venue = b.venue?.trim();
  if (!venue || !b.event_date || !FINAL.includes(b.status ?? '')) return;
  const start = b.event_date;
  const end = b.end_date && b.end_date > start ? b.end_date : start;
  let q = supabase.from('bookings').select('id')
    .eq('venue', venue).in('status', FINAL)
    .lte('event_date', end)
    .or(`end_date.gte.${start},and(end_date.is.null,event_date.gte.${start})`);
  if (ignoreId) q = q.neq('id', ignoreId);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  if (data && data.length > 0) throw new Error('Another confirmed booking already uses this venue on these dates.');
};

export const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (booking: Partial<Booking>) => {
      await assertVenueFree(booking);
      const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select('*, customer:customers(*), menu:menus(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
};

export const useUpdateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Booking> & { id: string }) => {
      if ('venue' in updates || 'event_date' in updates || 'end_date' in updates) {
        const { data: cur, error: curErr } = await supabase
          .from('bookings').select('venue, event_date, end_date, status').eq('id', id).single();
        if (curErr) throw curErr;
        await assertVenueFree({ ...cur, ...updates }, id);
      }
      const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select('*, customer:customers(*), menu:menus(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
};

// Quotations block a booking's delete on the live database, so the ones the user agreed to lose go first.
export const useDeleteBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, withQuotes }: { id: string; withQuotes: boolean }) => {
      if (withQuotes) {
        const { error: qe } = await supabase.from('quotations').delete().eq('booking_id', id);
        if (qe) throw qe;
      }
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
    },
  });
};