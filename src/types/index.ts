export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
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
  created_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  customer?: Customer;
  event_type: string;
  event_date: string;
  event_time?: string;
  venue: string;
  guest_count: number;
  menu_id?: string;
  menu?: Menu;
  special_instructions?: string;
  status: 'inquiry' | 'followup' | 'confirmed' | 'completed' | 'cancelled' | 'pending';
  estimated_cost: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  booking_id: string;
  booking?: Booking;
  invoice_number: string;
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  advance_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issue_date: string;
  line_items?: LineItem[];
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
  fssai_certificate_url?: string;
  updated_at?: string;
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
