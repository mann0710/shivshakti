import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Invoice } from '../types';

export const useInvoices = () =>
  useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, booking:bookings(*, customer:customers(*), menu:menus(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      // Auto-generate invoice number
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`;

      const subtotal = invoice.subtotal || 0;
      const gst_rate = 18;
      const gst_amount = Math.round((subtotal * gst_rate) / 100);
      const total_amount = subtotal + gst_amount;
      const balance_due = total_amount - (invoice.advance_paid || 0);

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoice,
          invoice_number: invoiceNumber,
          gst_rate,
          gst_amount,
          total_amount,
          balance_due,
        })
        .select('*, booking:bookings(*, customer:customers(*), menu:menus(*))')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

export const useRecordPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      payment_mode,
      notes,
    }: {
      invoiceId: string;
      amount: number;
      payment_mode: string;
      notes?: string;
    }) => {
      // Insert payment record
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id: invoiceId,
        amount,
        payment_mode,
        notes,
      });
      if (payErr) throw payErr;

      // Update invoice balance
      const { data: inv } = await supabase
        .from('invoices')
        .select('advance_paid, total_amount')
        .eq('id', invoiceId)
        .single();

      if (inv) {
        const newAdvance = (inv.advance_paid || 0) + amount;
        const newBalance = inv.total_amount - newAdvance;
        const newStatus = newBalance <= 0 ? 'paid' : 'sent';
        await supabase
          .from('invoices')
          .update({ advance_paid: newAdvance, balance_due: newBalance, status: newStatus })
          .eq('id', invoiceId);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};