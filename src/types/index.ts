export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
  gstin?: string | null;
  created_at: string;
}

export interface Menu {
  id: string;
  name: string;
  description?: string;
  price_per_plate: number;
  category: string;
  items: string[];
  is_active: boolean;
  // Price by guest count; empty means one price (see lib/priceTiers).
  price_tiers?: PriceTier[] | null;
  created_at: string;
}

// Up to `upto` guests (null: and more) costs `price` a plate.
export interface PriceTier { upto: number | null; price: number }

export interface Booking {
  id: string;
  customer_id: string;
  customer?: Customer;
  event_type: string;
  event_date: string;
  end_date?: string | null;
  event_time?: string | null;
  venue: string;
  guest_count: number;
  menu_id?: string | null;
  menu?: Menu;
  special_instructions?: string;
  status: 'inquiry' | 'followup' | 'confirmed' | 'completed' | 'cancelled' | 'pending';
  estimated_cost: number;
  food_type?: string | null;
  // Advance taken when the quote was accepted, before an invoice exists.
  advance_received?: number;
  advance_mode?: string | null;
  advance_date?: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  booking_id: string;
  booking?: Booking;
  quotation_id?: string;
  invoice_number: string;
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  gst_rate: number;
  gst_amount: number;
  transportation_charge: number;
  transportation_charges?: { description: string; amount: number }[];
  total_amount: number;
  advance_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issue_date: string;
  line_items?: LineItem[];
  extra_charges?: { description: string; amount: number }[];
  additional_discounts?: { id: string; description: string; amount: number }[];
  is_multi_day?: boolean;
  event_days?: any[];
  created_at: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_type: 'advance' | 'partial';
  payment_mode: 'cash' | 'upi' | 'bank_transfer' | 'cheque';
  notes?: string;
  created_at: string;
}

export interface DataCenter {
  id: string;
  gst_number?: string;
  gst_rate?: number;
  fssai_certificate_url?: string;
  // Default sweet pack sizes per unit (grams / ml / pieces)
  pack_sizes?: Partial<Record<'kg' | 'ltr' | 'pc', number[]>> | null;
  // Printed-document settings (see lib/docs/settings)
  doc_settings?: Record<string, unknown> | null;
  updated_at?: string;
}

// A login on the staff list and what it may do.
export type StaffRole = 'owner' | 'counter' | 'kitchen';
export interface StaffLogin {
  email: string;
  name?: string | null;
  mobile?: string | null;
  role: StaffRole;
  can_sign_in: boolean;
  invited_at?: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  created_at: string;
}

export interface EventType {
  id: string;
  name: string;
  created_at: string;
}
