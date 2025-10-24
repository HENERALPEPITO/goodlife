export type UserRole = "artist" | "label" | "manager";

export interface Track {
  id: string;
  title: string;
  isrc: string;
  composers: string;
  releaseDate: string; // ISO date
  platform: string; // e.g., Spotify, Apple Music
  territory: string; // e.g., US, Global
  createdAt: string; // ISO date
}

export interface RoyaltyStatement {
  id: string;
  trackId: string;
  trackTitle: string;
  platform: string;
  period: string; // e.g., 2025-Q3
  streams: number;
  revenueUsd: number;
  status: "paid" | "pending";
}

export interface ProfileSettings {
  name: string;
  email: string;
  role: UserRole;
}

export interface InvoicingSettings {
  labelName: string;
  address: string;
  billingEmail: string;
  paymentMode: "bank" | "apple_pay";
}


