import jsPDF from 'jspdf';
import { openWhatsApp } from './receipt';

export type ShareResult = 'shared' | 'whatsapp' | 'cancelled';

// Phones (Android Chrome, iOS Safari) share the PDF itself, e.g. straight into WhatsApp.
// Desktops download the PDF and open WhatsApp with the message, so the file can be attached.
export async function sharePdf(doc: jsPDF, fileName: string, text: string, phone?: string | null): Promise<ShareResult> {
  const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: fileName });
      return 'shared';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  doc.save(fileName);
  if (phone) openWhatsApp(phone, text);
  else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return 'whatsapp';
}
