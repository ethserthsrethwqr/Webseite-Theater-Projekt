export interface Show {
  id: number;
  title: string;
  date: string;
  time: string;
  description: string;
  price: number;       // Erwachsene (ab 18)
  price_child: number; // Kinder (unter 18)
  total_seats: number;
  available_seats: number;
  image_url?: string;
  location_name?: string;
  location_address?: string;
  entry_offset?: number;
  sales_lock_after_start?: number;
  section_key?: 'left' | 'right';
  section_title?: string;
  group_id?: number | null;
  group_name?: string;
}

export interface Ticket {
  id: number;
  show_id: number;
  customer_name: string;
  customer_email: string;
  code: string;
  ticket_type: 'adult' | 'child';
  status: 'valid' | 'used' | 'cancelled';
  created_at: string;
  show_title: string;
  show_date: string;
  show_time: string;
  image_url?: string;
  show_price: number;
}
