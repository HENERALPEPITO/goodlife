"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Mail, Phone, MapPin, MessageCircle, Lock } from "lucide-react";

interface ArtistProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  address_locked: boolean;
  created_at: string;
}

export default function ArtistProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editAddressOpen, setEditAddressOpen] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (user && user.role === "artist") {
      fetchProfile();
    }
  }, [user, authLoading, router]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Fetch artist profile by user_id
      const response = await fetch(`/api/artists?userId=${user?.id}`);
      
      let artist = null;
      
      if (response.ok) {
        const data = await response.json();
        artist = data.artist;
      } else {
        // If API returns an error, check if it's just because no artist record exists
        const errorData = await response.json().catch(() => ({}));
        console.log("API response not ok, but continuing:", errorData);
      }
      
      if (artist) {
        setProfile(artist);
        setAddress(artist.address || "");
      } else {
        // If no artist record exists, create a basic profile object
        setProfile({
          id: user?.id || "",
          name: user?.email || "",
          email: user?.email || "",
          phone: "",
          address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain",
          address_locked: false,
          created_at: new Date().toISOString(),
        });
        setAddress("Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain");
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      // Even if there's an error, show default profile
      setProfile({
        id: user?.id || "",
        name: user?.email || "",
        email: user?.email || "",
        phone: "",
        address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain",
        address_locked: false,
        created_at: new Date().toISOString(),
      });
      setAddress("Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAddress = () => {
    if (profile?.address_locked) {
      toast({
        title: "Address Locked",
        description: "To modify your address again, please contact admin support.",
        variant: "destructive",
      });
      return;
    }
    setConfirmEditOpen(true);
  };

  const confirmAddressEdit = () => {
    setConfirmEditOpen(false);
    setEditAddressOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/artists/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to update address");
      }

      const { message } = await response.json();
      toast({
        title: "Success",
        description: message || "Address successfully updated",
      });
      setEditAddressOpen(false);
      fetchProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update address",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent(
      "Hello Admin, I would like to request an address change for my account."
    );
    window.open(`https://wa.me/34693432506?text=${message}`, "_blank");
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="transition-colors" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
          Loading profile...
        </div>
      </div>
    );
  }

  if (!user || user.role !== "artist") {
    return null;
  }

  return (
    <div
      className="space-y-6"
      style={{
        backgroundColor: isDark ? "transparent" : "#F9FAFB",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
        >
          My Profile
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
        >
          View and manage your profile information
        </p>
      </div>

      {/* Profile Information Card */}
      <div
        className="rounded-lg border p-6"
        style={{
          backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          boxShadow: isDark ? "none" : "rgba(0, 0, 0, 0.05)",
        }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
        >
          Profile Information
        </h2>

        <div className="space-y-4">
          {/* Artist Name */}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
              }}
            >
              <User className="h-5 w-5" style={{ color: "#3B82F6" }} />
            </div>
            <div>
              <div
                className="text-sm"
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Artist Name
              </div>
              <div
                className="font-medium"
                style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
              >
                {profile?.name || user.email}
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.1)",
              }}
            >
              <Mail className="h-5 w-5" style={{ color: "#10B981" }} />
            </div>
            <div>
              <div
                className="text-sm"
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Contact Email
              </div>
              <div
                className="font-medium"
                style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
              >
                {profile?.email || user.email}
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: isDark ? "rgba(168, 85, 247, 0.2)" : "rgba(168, 85, 247, 0.1)",
              }}
            >
              <Phone className="h-5 w-5" style={{ color: "#A855F7" }} />
            </div>
            <div>
              <div
                className="text-sm"
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Phone Number
              </div>
              <div
                className="font-medium"
                style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
              >
                {profile?.phone || "—"}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: isDark ? "rgba(251, 146, 60, 0.2)" : "rgba(251, 146, 60, 0.1)",
              }}
            >
              <MapPin className="h-5 w-5" style={{ color: "#FB923C" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-sm"
                  style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
                >
                  Address
                  {profile?.address_locked && (
                    <span className="ml-2">
                      <Lock className="h-3 w-3 inline" />
                    </span>
                  )}
                </div>
                {!profile?.address_locked && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditAddress}
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                      color: isDark ? "#FFFFFF" : "#1F2937",
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <div
                className="font-medium"
                style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
              >
                {profile?.address || "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain"}
              </div>
              {profile?.address_locked && (
                <p
                  className="text-xs mt-2"
                  style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
                >
                  To modify your address again, please contact admin support.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Contact Button */}
      {profile?.address_locked && (
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
            boxShadow: isDark ? "none" : "rgba(0, 0, 0, 0.05)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
          >
            Need to Update Your Address?
          </h2>
          <p
            className="text-sm mb-4"
            style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
          >
            Your address is locked. To request an address change, please contact the admin via WhatsApp.
          </p>
          <Button
            onClick={handleWhatsAppContact}
            className="flex items-center gap-2"
            style={{
              backgroundColor: "#25D366",
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1EB855";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#25D366";
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Contact Admin via WhatsApp
          </Button>
        </div>
      )}

      {/* Confirm Edit Address Dialog */}
      <Dialog open={confirmEditOpen} onOpenChange={setConfirmEditOpen}>
        <DialogContent
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              Confirm Address Edit
            </DialogTitle>
          </DialogHeader>
          <p
            className="py-4"
            style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
          >
            You can only edit your address once. Are you sure you want to proceed?
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmEditOpen(false)}
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                color: isDark ? "#FFFFFF" : "#1F2937",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAddressEdit}
              style={{
                backgroundColor: "#1D4ED8",
                color: "#FFFFFF",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#2563EB";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#1D4ED8";
              }}
            >
              Yes, Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog */}
      <Dialog open={editAddressOpen} onOpenChange={setEditAddressOpen}>
        <DialogContent
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              Edit Address
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Address
              </label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter your address"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
              <p
                className="text-xs mt-2"
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                You can only edit your address once. After saving, you'll need to contact admin to make further changes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditAddressOpen(false)}
              disabled={saving}
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                color: isDark ? "#FFFFFF" : "#1F2937",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAddress}
              disabled={saving || !address.trim()}
              style={{
                backgroundColor: "#1D4ED8",
                color: "#FFFFFF",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = "#2563EB";
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.backgroundColor = "#1D4ED8";
                }
              }}
            >
              {saving ? "Saving..." : "Save Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

