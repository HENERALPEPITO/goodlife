export type UserRole = "artist" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Track {
  id: string;
  artist_id: string;
  title: string;
  iswc: string | null;
  composers: string | null;
  release_date: string | null;
  platform: string | null;
  territory: string | null;
  created_at: string;
}

export interface Royalty {
  id: string;
  track_id: string | null;
  track_title: string | null;
  artist_id: string;
  artist_email: string | null;
  platform: string | null;
  usage_count: number | null;
  gross_amount: number | null;
  admin_percent: number | null;
  net_amount: number | null;
  broadcast_date: string | null;
  exploitation_source_name: string | null;
  territory: string | null;
  paid_status: "unpaid" | "pending" | "paid";
  payment_request_id: string | null;
  created_at: string;
  // Track metadata (joined from tracks table)
  isrc: string | null;
  composer_name: string | null;
}

export interface PaymentRequest {
  id: string;
  artist_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  artist_id: string;
  amount: number;
  mode_of_payment: string;
  invoice_number: string;
  status: "pending" | "approved" | "paid" | "rejected";
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequest {
  id: string;
  artist_id: string;
  total_amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  remarks: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentReceipt {
  id: string;
  payment_request_id: string;
  artist_id: string;
  total_amount: number;
  pdf_url: string | null;
  receipt_number: string;
  created_at: string;
}

export interface CSVRoyaltyRow {
  "Song Title": string;
  "ISWC": string;
  "Composer": string;
  "Date": string;
  "Territory": string;
  "Source": string;
  "Usage Count": string;
  "Gross": string;
  "Admin %": string;
  "Net": string;
}

export interface RoyaltyStatement {
  id: string;
  trackTitle: string;
  platform: string;
  period: string;
  streams: number;
  revenueUsd: number;
  status: "paid" | "pending";
}


