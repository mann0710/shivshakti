import { useCreateCustomer, useDeleteCustomer, useUpdateCustomer } from '../../hooks/useCustomers';
import { useCreateSeasonalCustomer, useDeleteSeasonalCustomer, useUpdateSeasonalCustomer } from '../../hooks/useSeasonalCustomers';
import { useHasPriceColumns } from '../../hooks/useSchemaStatus';
import { Person, Side, phoneKey } from '../../lib/people';
import { cleanGstin } from '../../lib/gst';

export interface PersonInput { name: string; phone: string; email: string; address: string; gstin: string; notes: string; buys: Side[] }

const opt = (v: string) => v.trim() || undefined;

// Writes one person to whichever of the two customer lists they belong in.
export function usePersonActions() {
  const hasGstin = useHasPriceColumns();
  const createC = useCreateCustomer();
  const updateC = useUpdateCustomer();
  const deleteC = useDeleteCustomer();
  const createS = useCreateSeasonalCustomer();
  const updateS = useUpdateSeasonalCustomer();
  const deleteS = useDeleteSeasonalCustomer();

  const cateringRow = (f: PersonInput) => ({
    name: f.name.trim(), phone: phoneKey(f.phone) || f.phone.trim(), email: opt(f.email) ?? '', address: f.address.trim(), notes: f.notes.trim(),
    ...(hasGstin ? { gstin: f.gstin.trim() ? cleanGstin(f.gstin) : null } : {}),
  });
  const sweetsRow = (f: PersonInput) => ({ name: f.name.trim(), phone: opt(phoneKey(f.phone) || f.phone), address: opt(f.address), notes: opt(f.notes) });

  // New or edited person; returns the key the list knows them by.
  const save = async (f: PersonInput, p?: Person): Promise<string> => {
    const created: string[] = [];
    if (p) {
      await Promise.all([
        ...p.catering.map(c => updateC.mutateAsync({ id: c.id, ...cateringRow(f) })),
        ...p.sweets.map(s => updateS.mutateAsync({ id: s.id, ...sweetsRow(f) })),
      ]);
    }
    if (f.buys.includes('catering') && !p?.catering.length) created.push(`c:${(await createC.mutateAsync(cateringRow(f))).id}`);
    if (f.buys.includes('sweets') && !p?.sweets.length) created.push(`s:${(await createS.mutateAsync(sweetsRow(f))).id}`);
    return phoneKey(f.phone) || p?.key || created[0] || '';
  };

  // Catering records go first: the database refuses while bookings still point at them.
  const remove = async (p: Person) => {
    for (const c of p.catering) await deleteC.mutateAsync(c.id);
    for (const s of p.sweets) await deleteS.mutateAsync(s.id);
  };

  // One name (and any missing address or notes) on every saved copy; returns how to put it back.
  const combine = async (p: Person, name: string) => {
    const before = { c: p.catering.map(c => ({ id: c.id, name: c.name, address: c.address ?? '', notes: c.notes ?? '' })), s: p.sweets.map(s => ({ id: s.id, name: s.name, address: s.address ?? '', notes: s.notes ?? '' })) };
    const fill = { name: name.trim(), address: p.address, notes: p.notes };
    await Promise.all([
      ...p.catering.map(c => updateC.mutateAsync({ id: c.id, name: fill.name, address: c.address?.trim() || fill.address, notes: c.notes?.trim() || fill.notes })),
      ...p.sweets.map(s => updateS.mutateAsync({ id: s.id, name: fill.name, address: s.address?.trim() || opt(fill.address), notes: s.notes?.trim() || opt(fill.notes) })),
    ]);
    return () => Promise.all([
      ...before.c.map(r => updateC.mutateAsync(r)),
      ...before.s.map(r => updateS.mutateAsync(r)),
    ]);
  };

  // A catering record to book against, made from the sweets one when needed.
  const cateringId = async (p: Person): Promise<string> => {
    if (p.catering[0]) return p.catering[0].id;
    const row = await createC.mutateAsync({ name: p.name, phone: phoneKey(p.phone) || p.phone, address: p.address, notes: p.notes });
    return row.id;
  };

  const busy = createC.isPending || updateC.isPending || createS.isPending || updateS.isPending || deleteC.isPending || deleteS.isPending;
  return { save, remove, combine, cateringId, busy, hasGstin };
}
