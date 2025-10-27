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
  artist_id: string;
  usage_count: number | null;
  gross_amount: number | null;
  admin_percent: number | null;
  net_amount: number | null;
  broadcast_date: string | null;
  exploitation_source_name: string | null;
  territory: string | null;
  created_at: string;
}

export interface PaymentRequest {
  id: string;
  artist_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
  updated_at: string;
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


