import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { Invoice, Payment } from '../types';
import { todayIST } from '../lib/ist';
import { sumCharges } from '../lib/quoteMath';

// Unpaid = draft, part paid = sent; a zero total with nothing paid stays draft.
export const invoiceStatus = (total: number, paid: number): Invoice['status'] =>
  paid > 0 && paid >= total ? 'paid' : paid > 0 ? 'sent' : 'draft';

// Recalculate paid/balance/status from payments; completes the booking when paid, reopens it when not.
const recalculateInvoice = async (invoiceId: string) => {
  const { data: payments, error: payErr } = await supabase
    .from('payments').select('amount').eq('invoice_id', invoiceId);
  if (payErr) throw payErr;
  const totalPaid = (payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  const { data: inv, error: invErr } = await supabase
    .from('invoices').select('total_amount, booking_id').eq('id', invoiceId).single();
  if (invErr) throw invErr;
  if (!inv) return;

  const newBalance = Math.max(0, Number(inv.total_amount) - totalPaid);
  const newStatus = invoiceStatus(Number(inv.total_amount), totalPaid);
  const { error } = await supabase.from('invoices')
    .update({ advance_paid: totalPaid, balance_due: newBalance, status: newStatus })
    .eq('id', invoiceId);
  if (error) throw error;

  if (!inv.booking_id) return;
  const sync = newStatus === 'paid'
    ? supabase.from('bookings').update({ status: 'completed' }).eq('id', inv.booking_id).eq('status', 'confirmed')
    : supabase.from('bookings').update({ status: 'confirmed' }).eq('id', inv.booking_id).eq('status', 'completed');
  const { error: bookErr } = await sync;
  if (bookErr) throw bookErr;
};

export const useInvoices = () =>
  useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      return fetchAll<Invoice>((from, to) => supabase
        .from('invoices').select('*, booking:bookings(*, customer:customers(*), menu:menus(*))')
        .order('created_at', { ascending: false }).range(from, to));
    },
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ advance_mode = 'cash', ...invoice }: Partial<Invoice> & { advance_mode?: Payment['payment_mode'] }) => {
      const subtotal = invoice.subtotal || 0;
      const discount_amount = invoice.discount_amount || 0;
      const discount_type = invoice.discount_type || 'amount';
      const discountedSubtotal = Math.max(0, subtotal - discount_amount);
      // Preserve GST from quotation if passed; default off
      const gst_rate = invoice.gst_rate || 0;
      const gst_amount = invoice.gst_amount || 0;
      const transportation_charges = (invoice.transportation_charges || []) as { amount: number }[];
      const transportation_charge = transportation_charges.reduce((s, c) => s + (c.amount || 0), 0) || invoice.transportation_charge || 0;
      const total_amount = discountedSubtotal + gst_amount + transportation_charge + sumCharges(invoice.extra_charges);
      const advance = Math.max(0, invoice.advance_paid || 0);
      const balance_due = Math.max(0, total_amount - advance);

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoice, // invoice_number is assigned by a database trigger
          discount_amount,
          discount_type,
          gst_rate,
          gst_amount,
          transportation_charge,
          total_amount,
          balance_due,
          issue_date: invoice.issue_date || todayIST(),
        })
        .select('*, booking:bookings(*, customer:customers(*), menu:menus(*))')
        .single();
      if (error) throw error;
      // The advance becomes a real payment row so later payments don't overwrite it.
      if (advance > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          invoice_id: data.id, amount: advance, payment_type: 'advance', payment_mode: advance_mode,
          notes: 'Advance received before invoice', payment_date: todayIST(),
        });
        if (payErr) throw payErr;
        await recalculateInvoice(data.id);
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['all_payments'] });
    },
  });
};

export const useRecordPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId, amount, payment_type, payment_mode, notes, payment_date,
    }: {
      invoiceId: string; amount: number; payment_type: 'advance' | 'partial';
      payment_mode: string; notes?: string; payment_date?: string;
    }) => {
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id: invoiceId, amount, payment_type, payment_mode, notes,
        payment_date: payment_date || todayIST(),
      });
      if (payErr) throw payErr;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['all_payments'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const useUpdatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, invoiceId, amount, payment_type, payment_mode, notes, payment_date,
    }: {
      id: string; invoiceId: string; amount: number; payment_type: 'advance' | 'partial';
      payment_mode: string; notes?: string; payment_date: string;
    }) => {
      const { error } = await supabase.from('payments')
        .update({ amount, payment_type, payment_mode, notes, payment_date })
        .eq('id', id);
      if (error) throw error;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['all_payments'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const useDeletePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments', invoiceId] });
      qc.invalidateQueries({ queryKey: ['all_payments'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const usePaymentHistory = (invoiceId: string | undefined) =>
  useQuery({
    queryKey: ['payments', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments').select('*')
        .eq('invoice_id', invoiceId!)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

// Unified recalculation — handles discount, GST, transportation_charges array, extra_charges
export const useRecalculateTotals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, discount_amount, discount_type, apply_gst, gst_rate: customGstRate, transportation_charges = [], additional_discounts = [], extra_charges }: {
      invoiceId: string;
      discount_amount: number;
      discount_type: 'amount' | 'percentage';
      apply_gst: boolean;
      gst_rate?: number;
      transportation_charges?: { description: string; amount: number }[];
      additional_discounts?: { id: string; description: string; amount: number }[];
      extra_charges?: { description: string; amount: number }[];
    }) => {
      const { data: inv } = await supabase
        .from('invoices').select('subtotal, extra_charges').eq('id', invoiceId).single();
      if (!inv) throw new Error('Invoice not found');
      const discAmt = discount_type === 'percentage'
        ? Math.round((inv.subtotal * discount_amount) / 100)
        : discount_amount;
      const discountedSubtotal = Math.max(0, inv.subtotal - discAmt);
      const appliedRate = customGstRate ?? 18;
      const gst_rate = apply_gst ? appliedRate : 0;
      const gst_amount = apply_gst ? Math.round((discountedSubtotal * appliedRate) / 100) : 0;
      const effectiveExtraCharges = extra_charges !== undefined
        ? extra_charges
        : ((inv.extra_charges || []) as { description: string; amount: number }[]);
      const extraChargesTotal = effectiveExtraCharges.reduce((s, c) => s + (c.amount || 0), 0);
      const transportation_charge = transportation_charges.reduce((s, c) => s + (c.amount || 0), 0);
      const total_amount = discountedSubtotal + gst_amount + transportation_charge + extraChargesTotal;
      const { error } = await supabase.from('invoices').update({
        discount_amount: discAmt, discount_type,
        gst_rate, gst_amount, transportation_charge, transportation_charges,
        additional_discounts,
        ...(extra_charges !== undefined ? { extra_charges } : {}),
        total_amount,
      }).eq('id', invoiceId);
      if (error) throw error;
      await recalculateInvoice(invoiceId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

export const useUpdateEventDays = () => {
  const qc = useQueryClient();
  return useMutation({
    // Final guest counts: multi-day sends edited days, single-day only the new subtotal.
    mutationFn: async ({ invoiceId, event_days, subtotal }: { invoiceId: string; event_days?: any[]; subtotal: number }) => {
      const { error } = await supabase.from('invoices').update(event_days ? { event_days, subtotal } : { subtotal }).eq('id', invoiceId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};

export const useAllPayments = () =>
  useQuery({
    queryKey: ['all_payments'],
    queryFn: async () => {
      return fetchAll<Pick<Payment, 'id' | 'amount' | 'payment_type' | 'created_at'>>((from, to) => supabase
        .from('payments').select('id, amount, payment_type, created_at').order('created_at').range(from, to));
    },
  });
