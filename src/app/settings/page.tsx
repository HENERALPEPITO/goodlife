"use client";
import { useState } from "react";
import { InvoicingSettings, ProfileSettings, UserRole } from "@/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileSettings>({ name: "Carl Benedict Elipan", email: "carl@example.com", role: "artist" });
  const [invoice, setInvoice] = useState<InvoicingSettings>({ labelName: "GoodLife Records", address: "123 Music Ave, LA, CA", billingEmail: "billing@goodlife.com", paymentMode: "bank" });

  function save() {
    alert("Settings saved (mock)");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
        <h2 className="text-sm font-medium mb-4">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="px-3 py-2 rounded border bg-transparent" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Name" />
          <input type="email" className="px-3 py-2 rounded border bg-transparent" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email" />
          <select className="px-3 py-2 rounded border bg-transparent" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value as UserRole })}>
            <option value="artist">Artist</option>
            <option value="label">Label</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950">
        <h2 className="text-sm font-medium mb-4">Invoicing</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="px-3 py-2 rounded border bg-transparent" value={invoice.labelName} onChange={(e) => setInvoice({ ...invoice, labelName: e.target.value })} placeholder="Label/Company Name" />
          <input className="px-3 py-2 rounded border bg-transparent" value={invoice.billingEmail} onChange={(e) => setInvoice({ ...invoice, billingEmail: e.target.value })} placeholder="Billing Email" />
          <input className="px-3 py-2 rounded border bg-transparent md:col-span-2" value={invoice.address} onChange={(e) => setInvoice({ ...invoice, address: e.target.value })} placeholder="Address" />
          <select className="px-3 py-2 rounded border bg-transparent" value={invoice.paymentMode} onChange={(e) => setInvoice({ ...invoice, paymentMode: e.target.value as any })}>
            <option value="bank">Bank</option>
            <option value="apple_pay">Apple Pay</option>
          </select>
        </div>
      </section>

      <div>
        <button onClick={save} className="px-3 py-2 text-sm rounded border hover:bg-zinc-100 dark:hover:bg-zinc-900">Save Changes</button>
      </div>
    </div>
  );
}


