import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Booking } from '../types';

export const useBookings = () =>
  useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, customer:customers(*), menu:menus(*)')
        .order('event_date', { ascending: true });
      if (error) throw error;
      return data as Booking[];
    },
  });

export const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (booking: Partial<Booking>) => {
      // Check for date conflict first
      const { data: existing } = await supabase
        .from('bookings')
        .select('id, venue')
        .eq('event_date', booking.event_date!)
        .eq('venue', booking.venue!)
        .neq('status', 'cancelled');
      if (existing && existing.length > 0) {
        throw new Error('Another booking already exists at this venue on the same date.');
      }
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

export const useDeleteBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  });
};