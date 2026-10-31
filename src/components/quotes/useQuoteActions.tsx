import React from 'react';
import toast from 'react-hot-toast';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import type { Navigate } from '../../hooks/useNavIntent';
import { Quotation, useDeleteQuotation } from '../../hooks/useQuotations';
import { useCreateMenu } from '../../hooks/useMenus';
import { useConfirm } from '../ui/ConfirmDialog';
import { siblingsOf, nextLabel, quoteCopy } from '../../lib/quoteOptions';
import { quotePdf } from '../../lib/quotationShare';
import { downloadDoc } from '../../lib/docs/output';
import type { QuoteActions } from './QuoteMenu';

interface Flow {
  accept: (q: Quotation, picks?: Set<string>) => void;
  share: (q: Quotation, withPrices?: boolean, options?: Quotation[], startAll?: boolean) => void;
  setStatus: (q: Quotation, status: string) => void;
}

interface Args { f: QuoteForm; flow: Flow; pdfPrices: boolean; openEdit: (q: Quotation) => void; onNavigate?: Navigate }

// The list's actions on a quote, shared by rows, the side panel, the ⋯ menu and the editor.
export function useQuoteActions({ f, flow, pdfPrices, openEdit, onNavigate }: Args) {
  const deleteQuotation = useDeleteQuotation();
  const createMenu = useCreateMenu();
  const { confirm, dialog } = useConfirm();
  const fail = (e: any, text: string) => toast.error(e?.message || text);

  const remove = async (q: Quotation) => {
    const ok = await confirm({ title: 'Delete quote?', message: `${q.quotation_number}${q.customer?.name ? ` for ${q.customer.name}` : ''} will be deleted. This can't be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteQuotation.mutateAsync(q.id);
      // The last option left becomes a plain quotation.
      const rest = siblingsOf(q, f.quotations).filter(s => s.id !== q.id);
      if (q.option_group && rest.length === 1) await f.updateQuotation.mutateAsync({ id: rest[0].id, option_group: null, option_label: null, option_name: null });
      if (f.editingId === q.id) f.resetForm();
      toast.success(`${q.quotation_number} deleted`);
    } catch (e) { fail(e, 'Could not delete'); }
  };

  // "Copied as QTN-0024  [Open]"
  const duplicate = async (q: Quotation) => {
    try {
      const created: Quotation = await f.createQuotation.mutateAsync(quoteCopy(q));
      toast(t => (
        <span className="q-toast">Copied as {created.quotation_number}
          <button type="button" onClick={() => { toast.dismiss(t.id); openEdit(created); }}>Open</button>
        </span>
      ), { duration: 6000 });
    } catch (e) { fail(e, 'Could not copy'); }
  };

  // Copies a quote as the next option (B, C…) of the same enquiry and opens it.
  const addOption = async (cur: Quotation) => {
    try {
      const saved = f.quotations.find(x => x.id === cur.id) ?? cur;
      const group = saved.option_group || crypto.randomUUID();
      const sibs = saved.option_group ? siblingsOf(saved, f.quotations) : [{ ...saved, option_label: 'A' }];
      if (!saved.option_group) await f.updateQuotation.mutateAsync({ id: saved.id, option_group: group, option_label: 'A' });
      const label = nextLabel(sibs);
      const created: Quotation = await f.createQuotation.mutateAsync({ ...quoteCopy({ ...saved, ...cur }), option_group: group, option_label: label, option_name: null });
      openEdit(created);
      toast.success(`Option ${label} added — change only what differs`);
    } catch (e) { fail(e, 'Could not add an option'); }
  };

  // The quote's dishes and plate price become a package for next time.
  const savePackage = async (q: Quotation) => {
    const name = [q.customer?.name, q.booking?.event_type, q.option_name].filter(Boolean).join(' · ') || q.quotation_number;
    try {
      await createMenu.mutateAsync({ name, description: `From ${q.quotation_number}`, price_per_plate: q.per_plate_amount, category: 'Package', items: (q.items ?? []).map(i => i.item_name), is_active: true });
      toast.success(`Saved as package "${name}"`);
    } catch (e) { fail(e, 'Could not save the package'); }
  };

  const actions: QuoteActions = {
    open: openEdit,
    send: (q, options) => flow.share(q, pdfPrices, options),
    pdf: (q, options) => downloadDoc(quotePdf(q, pdfPrices, options)),
    accept: flow.accept,
    duplicate,
    addOption,
    savePackage,
    setStatus: flow.setStatus,
    remove,
    invoice: q => (q.booking_id && onNavigate ? onNavigate('billing', { action: 'new', id: q.booking_id }) : toast.error('This quote has no booking to invoice')),
  };
  return { actions, dialog };
}
