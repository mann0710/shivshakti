import { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDataCenter, useUpsertDataCenter } from '../../hooks/useDataCenter';

const storagePath = (url: string) => {
  const m = url.match(/\/documents\/(.+?)(\?|$)/);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

export const fileNameOf = (url: string) => decodeURIComponent(url.split('/').pop()?.split('?')[0] || '').replace(/^\d+_/, '') || 'certificate';
export const uploadedOn = (url: string) => { const t = Number(url.match(/\/(?:fssai|logo)\/(\d+)_/)?.[1]); return t ? new Date(t) : null; };

// Puts a file in the "documents" storage bucket under `folder` and returns its link.
export async function uploadDocument(folder: string, file: File): Promise<string> {
  const path = `${folder}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, '_')}`;
  const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new Error(/bucket/i.test(error.message) ? 'The "documents" storage bucket is missing in Supabase.' : error.message);
  return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl;
}

export const removeDocument = async (url: string) => {
  const path = storagePath(url);
  if (path) await supabase.storage.from('documents').remove([path]).catch(() => {});
};

// Upload, replace, download and remove the FSSAI certificate in the "documents" storage bucket.
export function useFssai() {
  const { data: dc } = useDataCenter();
  const upsert = useUpsertDataCenter();
  const [busy, setBusy] = useState(false);
  const url = dc?.fssai_certificate_url || '';

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const publicUrl = await uploadDocument('fssai', file);
      await upsert.mutateAsync({ fssai_certificate_url: publicUrl });
      // The old file goes only after the new one is saved.
      if (url && url !== publicUrl) await removeDocument(url);
      toast.success(url ? 'Certificate replaced' : 'Certificate uploaded');
    } catch (e: any) { toast.error(e?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await upsert.mutateAsync({ fssai_certificate_url: '' });
      await removeDocument(url);
      toast.success('Certificate removed');
    } catch (e: any) { toast.error(e?.message || 'Could not remove'); }
    finally { setBusy(false); }
  };

  const download = async () => {
    try {
      const blob = await (await fetch(url)).blob();
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href, download: `fssai_${fileNameOf(url)}` });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);
    } catch { window.open(url, '_blank', 'noopener'); }
  };

  return { url, busy, upload, remove, download };
}
