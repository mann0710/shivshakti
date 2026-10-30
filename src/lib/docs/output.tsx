import React from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { printHtml, openWhatsApp } from '../receipt';
import { ensureLogo } from './context';
import type { Doc } from './quotationDoc';

export type ShareResult = 'shared' | 'whatsapp' | 'cancelled';

// Real PDF from the /api/pdf service; null when it is unavailable (local dev, offline).
export async function pdfBlob(doc: Doc): Promise<Blob | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ html: doc.html, footer: doc.footer }),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/pdf')) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

const save = (blob: Blob, name: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

// Builds after the logo is embedded, so the PDF service needs no network for it.
async function build(make: () => Doc): Promise<Doc> {
  await ensureLogo();
  return make();
}

export async function downloadDoc(make: () => Doc): Promise<void> {
  const id = toast.loading('Preparing PDF…');
  const doc = await build(make);
  const blob = await pdfBlob(doc);
  if (blob) { save(blob, doc.fileName); toast.success('PDF downloaded', { id }); return; }
  toast('Opening print — choose "Save as PDF"', { id, icon: '🖨' });
  printHtml(doc.html);
}

export const printDoc = async (make: () => Doc) => printHtml((await build(make)).html);

type Nav = Navigator & { canShare?: (d: ShareData) => boolean };

// Share sheet on phones (straight into WhatsApp), download + WhatsApp chat on desktops.
export async function shareDoc(make: () => Doc, text: string, phone?: string | null): Promise<ShareResult> {
  const id = toast.loading('Preparing PDF…');
  const doc = await build(make);
  const blob = await pdfBlob(doc);
  toast.dismiss(id);
  if (!blob) {
    printHtml(doc.html);
    if (phone) openWhatsApp(phone, text);
    toast('Save the PDF from the print window, then attach it in WhatsApp', { duration: 6000 });
    return 'whatsapp';
  }
  // A saved number goes straight to that customer's chat, like POS pre-bookings; WhatsApp links
  // cannot carry a file, so the PDF is saved for 📎 → Document.
  if (phone) {
    save(blob, doc.fileName);
    if (!openWhatsApp(phone, text)) {
      toast(t => <button type="button" onClick={() => { toast.dismiss(t.id); openWhatsApp(phone, text); }}
        style={{ border: 'none', background: '#128C7E', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}>
        PDF saved — open WhatsApp chat</button>, { duration: 15000 });
    }
    toast('PDF saved. In the chat tap 📎 → Document and pick it.', { duration: 8000 });
    return 'whatsapp';
  }
  const file = new File([blob], doc.fileName, { type: 'application/pdf' });
  const nav = navigator as Nav;
  if (nav.canShare?.({ files: [file] })) {
    const share = () => nav.share({ files: [file], text, title: doc.fileName });
    try { await share(); return 'shared'; } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
      // Waiting for the PDF used up the tap; ask for one more.
      if (e?.name === 'NotAllowedError') {
        toast(t => <button type="button" onClick={() => { toast.dismiss(t.id); share().catch(() => undefined); }}
          style={{ border: 'none', background: '#1A237E', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}>
          PDF ready — tap to share</button>, { duration: 15000 });
        return 'shared';
      }
    }
  }
  save(blob, doc.fileName);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'whatsapp';
}
