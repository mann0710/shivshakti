import toast from 'react-hot-toast';
import { useCustomers, useCreateCustomer } from './useCustomers';
import { cleanPhone, isValidPhone } from '../lib/money';

export interface CustomerDraft { customerId: string; name: string; phone: string; email?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Picked customer id, or a new one created from name + phone (reusing a match on phone).
export const useResolveCustomer = () => {
  const { data: customers = [] } = useCustomers();
  const createCustomer = useCreateCustomer();
  return async (d: CustomerDraft): Promise<string | null> => {
    if (d.customerId) return d.customerId;
    const name = d.name.trim();
    const phone = d.phone.trim();
    const email = (d.email ?? '').trim();
    if (!name) { toast.error('Select a customer or enter a new customer name'); return null; }
    if (phone && !isValidPhone(phone)) { toast.error('Phone must be a 10-digit mobile number'); return null; }
    if (email && !EMAIL_RE.test(email)) { toast.error('Enter a valid email address'); return null; }
    const dup = phone ? customers.find(c => cleanPhone(c.phone ?? '') === cleanPhone(phone)) : undefined;
    if (dup) toast(`Using existing customer ${dup.name}`);
    return dup?.id ?? (await createCustomer.mutateAsync({ name, phone: phone ? cleanPhone(phone) : '', email: email || undefined })).id;
  };
};
