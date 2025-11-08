"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import type { InvoiceSettings } from "@/lib/invoiceSettings";

export default function InvoiceSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [formData, setFormData] = useState({
    business_name: "",
    address: "",
    contact_person: "",
    phone: "",
    email: "",
    tax_id: "",
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      toast({
        title: "Access Denied",
        description: "You must be an admin to access this page.",
        variant: "destructive",
      });
      router.push("/");
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/invoice-settings");
      const data = await response.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
        setFormData({
          business_name: data.settings.business_name || "",
          address: data.settings.address || "",
          contact_person: data.settings.contact_person || "",
          phone: data.settings.phone || "",
          email: data.settings.email || "",
          tax_id: data.settings.tax_id || "",
        });
      }
    } catch (error) {
      console.error("Error fetching invoice settings:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || user.role !== "admin") return;

    try {
      setSaving(true);
      const response = await fetch("/api/invoice-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formData.phone,
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Invoice settings updated successfully",
        });
        setSettings(data.settings);
      } else {
        throw new Error(data.error || "Failed to update settings");
      }
    } catch (error: any) {
      console.error("Error updating invoice settings:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update invoice settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Invoice Settings</h1>
        <p className="text-gray-600">
          Update business information that appears on all invoices. These settings apply globally to all future invoices.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 space-y-6">
        <div>
          <Label htmlFor="business_name">Business Name</Label>
          <Input
            id="business_name"
            value={formData.business_name}
            disabled
            className="mt-1 bg-slate-50"
          />
          <p className="text-xs text-slate-500 mt-1">This field is fixed and cannot be edited</p>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            disabled
            className="mt-1 bg-slate-50"
            placeholder="e.g., Profesor Hermida 6, 3-3C, 36960 Sanxenxo (Spain)"
          />
          <p className="text-xs text-slate-500 mt-1">This field is fixed and cannot be edited</p>
        </div>

        <div>
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
            className="mt-1"
            placeholder="e.g., +34 693 43 25 06"
          />
        </div>

        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className="mt-1"
            placeholder="e.g., info@goodlifemusic.com"
          />
        </div>

        <div>
          <Label htmlFor="tax_id">TAX ID</Label>
          <Input
            id="tax_id"
            value={formData.tax_id}
            disabled
            className="mt-1 bg-slate-50"
            placeholder="e.g., B72510704"
          />
          <p className="text-xs text-slate-500 mt-1">This field is fixed and cannot be edited</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Only phone and email can be edited. Business name, address, and TAX ID are fixed. These settings will be applied to all invoices generated after saving.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

