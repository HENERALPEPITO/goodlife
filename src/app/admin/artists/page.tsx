"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Edit, Trash2, Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Artist {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  address_locked: boolean;
  created_at: string;
}

export default function AdminArtistsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmAddOpen, setConfirmAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    } else if (user && user.role === "admin") {
      fetchArtists();
    }
  }, [user, authLoading, router]);

  const fetchArtists = async () => {
    try {
      setLoading(true);
      
      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      const response = await fetch("/api/artists", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
      });
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch artists (${response.status})`;
        let errorDetails = "";
        
        try {
          const errorData = await response.json();
          
          // Check if errorData is actually an empty object
          const hasMeaningfulContent = errorData && typeof errorData === "object" && 
            (errorData.error || errorData.details || Object.keys(errorData).length > 0);
          
          if (hasMeaningfulContent) {
            errorMessage = errorData.error || errorData.details || errorMessage;
            errorDetails = errorData.details || errorData.error || "";
            console.error("API Error:", {
              status: response.status,
              error: errorData.error,
              details: errorData.details,
              code: errorData.code
            });
          } else {
            console.warn("Received empty error object");
            errorMessage = `Server returned empty response (${response.status}). Check server logs.`;
            errorDetails = "The server returned an empty error object. This may indicate a server configuration issue.";
          }
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            console.error("API Error (non-JSON):", errorText);
            errorMessage = errorText || errorMessage;
            errorDetails = errorText;
          } catch (textError) {
            console.error("API Error: Could not parse response", response.status);
            errorMessage = `Server error (${response.status}). Please check your server logs.`;
          }
        }
        
        const fullError = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;
        throw new Error(fullError);
      }
      
      const { artists: data } = await response.json();
      setArtists(data || []);
    } catch (error: any) {
      console.error("Error fetching artists:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load artists",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddArtist = async () => {
    try {
      console.log("Creating artist with data:", formData);
      
      if (!formData.name || !formData.email) {
        toast({
          title: "Validation Error",
          description: "Name and email are required",
          variant: "destructive",
        });
        return;
      }

      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      console.log("Access token available:", !!accessToken);

      console.log("Sending POST request to /api/artists...");
      console.log("Request body:", JSON.stringify(formData));
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      let response;
      try {
        response = await fetch("/api/artists", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          },
          body: JSON.stringify(formData),
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error("Request timeout after 30 seconds");
          throw new Error("Request timed out. Please check your server connection.");
        }
        console.error("Fetch error:", fetchError);
        throw new Error(`Network error: ${fetchError.message || "Failed to connect to server"}`);
      }
      
      console.log("Response received - status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `Failed to create artist (${response.status})`;
        let errorDetails = "";
        
        // Check content type to determine how to parse
        const contentType = response.headers.get("content-type") || "";
        const isJSON = contentType.includes("application/json");
        
        try {
          if (isJSON) {
            const errorData = await response.json();
            
            // Check if errorData has meaningful content
            const hasError = errorData?.error && typeof errorData.error === "string" && errorData.error.length > 0;
            const hasDetails = errorData?.details && typeof errorData.details === "string" && errorData.details.length > 0;
            const hasMeaningfulContent = hasError || hasDetails || (errorData && Object.keys(errorData).length > 0 && Object.values(errorData).some(v => v !== null && v !== undefined && v !== ""));
            
            if (hasMeaningfulContent) {
              errorMessage = errorData.error || errorData.details || errorMessage;
              errorDetails = errorData.details || errorData.error || "";
              console.error("API Error:", {
                status: response.status,
                error: errorData.error,
                details: errorData.details,
                type: errorData.type,
                code: errorData.code,
                fullError: errorData
              });
            } else {
              // Empty object or invalid data
              console.error("⚠️ EMPTY ERROR OBJECT DETECTED ⚠️");
              console.error("Raw errorData:", errorData);
              console.error("Error object type:", typeof errorData);
              console.error("Error object keys:", errorData ? Object.keys(errorData) : "null");
              console.error("Error object values:", errorData ? Object.values(errorData) : "null");
              console.error("Error object stringified:", JSON.stringify(errorData));
              console.error("Response status:", response.status);
              console.error("Response headers:", Object.fromEntries(response.headers.entries()));
              
              errorMessage = `Server configuration error (${response.status}). SUPABASE_SERVICE_ROLE_KEY is likely missing or incorrect.`;
              errorDetails = `Please check your .env.local file and ensure SUPABASE_SERVICE_ROLE_KEY is set correctly. The server returned an empty error object, which usually indicates a missing environment variable.`;
            }
          } else {
            // Not JSON, try to get text
            const textResponse = await response.text();
            console.error("API Error (non-JSON):", textResponse || "(empty)");
            errorMessage = textResponse || errorMessage;
            errorDetails = textResponse || "";
          }
        } catch (parseError: any) {
          console.error("Error parsing response:", parseError);
          // Try one more time with text
          try {
            const clonedResponse = response.clone();
            const textResponse = await clonedResponse.text();
            if (textResponse) {
              errorMessage = textResponse;
              errorDetails = textResponse;
            } else {
              errorMessage = `Server error (${response.status}). Could not parse response. Check server logs.`;
            }
          } catch (textError) {
            console.error("Could not read response body at all:", textError);
            errorMessage = `Server error (${response.status}). Please check your server logs.`;
          }
        }
        
        // Show detailed error message
        const fullError = errorDetails ? `${errorMessage}${errorDetails ? ': ' + errorDetails : ''}` : errorMessage;
        throw new Error(fullError);
      }

      const responseData = await response.json();
      console.log("Artist created successfully:", responseData);
      
      toast({
        title: "Success",
        description: responseData.message || "Artist successfully created",
      });
      setAddOpen(false);
      setConfirmAddOpen(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain",
      });
      await fetchArtists();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create artist",
        variant: "destructive",
      });
    }
  };

  const handleConfirmAdd = () => {
    setConfirmAddOpen(true);
  };

  const handleConfirmAddArtist = async () => {
    setConfirmAddOpen(false);
    // Add a small delay to allow dialog to close before showing loading state
    await new Promise(resolve => setTimeout(resolve, 100));
    await handleAddArtist();
  };

  const handleEditArtist = async () => {
    if (!selectedArtist) return;

    try {
      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(`/api/artists/${selectedArtist.id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `Failed to update artist (${response.status})`;
        console.error("API Error:", errorData);
        throw new Error(errorMessage);
      }

      const { message } = await response.json();
      toast({
        title: "Success",
        description: message || "Artist successfully updated",
      });
      setEditOpen(false);
      setSelectedArtist(null);
      fetchArtists();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update artist",
        variant: "destructive",
      });
    }
  };

  const handleDeleteArtist = async () => {
    if (!selectedArtist) return;

    try {
      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(`/api/artists/${selectedArtist.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `Failed to delete artist (${response.status})`;
        console.error("API Error:", errorData);
        throw new Error(errorMessage);
      }

      toast({
        title: "Success",
        description: "Artist successfully deleted",
      });
      setDeleteOpen(false);
      setSelectedArtist(null);
      fetchArtists();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete artist",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (artist: Artist) => {
    setSelectedArtist(artist);
    setFormData({
      name: artist.name,
      email: artist.email,
      phone: artist.phone || "",
      address: artist.address || "Profesor Hermida 6, 3-3C, 36960 Sanxenxo, Spain",
    });
    setEditOpen(true);
  };

  const openDeleteModal = (artist: Artist) => {
    setSelectedArtist(artist);
    setDeleteOpen(true);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="transition-colors" style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
          Loading artists...
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 
            className="text-2xl font-semibold" 
            style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
          >
            Artist Management
          </h1>
          <p 
            className="text-sm mt-1" 
            style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
          >
            Manage all registered artists
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
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
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Artist
        </Button>
      </div>

      {/* Artists Table */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          boxShadow: isDark ? "none" : "rgba(0, 0, 0, 0.05)",
        }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
            backgroundColor: isDark ? "rgba(31, 41, 55, 0.5)" : "#F7F8FA",
          }}
        >
          <h2 
            className="text-lg font-semibold" 
            style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
          >
            All Artists
          </h2>
        </div>

        {artists.length === 0 ? (
          <div 
            className="p-8 text-center" 
            style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
          >
            No artists registered yet. Click "Add Artist" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                style={{
                  backgroundColor: isDark ? "rgba(31, 41, 55, 0.5)" : "#F7F8FA",
                }}
              >
                <tr>
                  <th 
                    className="p-4 text-left font-medium" 
                    style={{ color: isDark ? "#9CA3AF" : "#1A1A1A" }}
                  >
                    Artist Name
                  </th>
                  <th 
                    className="p-4 text-left font-medium" 
                    style={{ color: isDark ? "#9CA3AF" : "#1A1A1A" }}
                  >
                    Email
                  </th>
                  <th 
                    className="p-4 text-left font-medium" 
                    style={{ color: isDark ? "#9CA3AF" : "#1A1A1A" }}
                  >
                    Phone
                  </th>
                  <th 
                    className="p-4 text-left font-medium" 
                    style={{ color: isDark ? "#9CA3AF" : "#1A1A1A" }}
                  >
                    Address
                  </th>
                  <th 
                    className="p-4 text-left font-medium" 
                    style={{ color: isDark ? "#9CA3AF" : "#1A1A1A" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {artists.map((artist) => (
                  <tr
                    key={artist.id}
                    className="border-t transition-colors"
                    style={{
                      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDark 
                        ? "rgba(31, 41, 55, 0.5)" 
                        : "#F9FAFB";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <td 
                      className="p-4 font-medium" 
                      style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}
                    >
                      {artist.name}
                    </td>
                    <td 
                      className="p-4" 
                      style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
                    >
                      {artist.email}
                    </td>
                    <td 
                      className="p-4" 
                      style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
                    >
                      {artist.phone || "—"}
                    </td>
                    <td 
                      className="p-4" 
                      style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
                    >
                      {artist.address || "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(artist)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDeleteModal(artist)}
                          style={{
                            borderColor: "#DC2626",
                            color: "#DC2626",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#DC2626";
                            e.currentTarget.style.color = "#FFFFFF";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "#DC2626";
                          }}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Artist Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              Add New Artist
            </DialogTitle>
            <DialogDescription style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
              Enter the artist's information below. Name and email are required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Artist Name <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter artist name"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Contact Email <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="artist@example.com"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Phone Number
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+34 123 456 789"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Address
              </label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                color: isDark ? "#FFFFFF" : "#1F2937",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAdd}
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
              Create Artist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Artist Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              Edit Artist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Artist Name <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter artist name"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Contact Email <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="artist@example.com"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Phone Number
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+34 123 456 789"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
            <div>
              <label 
                className="block text-sm font-medium mb-2" 
                style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
              >
                Address
              </label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
                style={{
                  backgroundColor: isDark ? "#374151" : "#F9FAFB",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                  color: isDark ? "#FFFFFF" : "#1F2937",
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                color: isDark ? "#FFFFFF" : "#1F2937",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditArtist}
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
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <p 
            className="py-4" 
            style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}
          >
            Are you sure you want to delete artist "{selectedArtist?.name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                color: isDark ? "#FFFFFF" : "#1F2937",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteArtist}
              style={{
                backgroundColor: "#DC2626",
                color: "#FFFFFF",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#B91C1C";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#DC2626";
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Add Artist Dialog */}
      <Dialog open={confirmAddOpen} onOpenChange={setConfirmAddOpen}>
        <DialogContent
          style={{
            backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              Confirm Create Artist
            </DialogTitle>
            <DialogDescription style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
              Are you sure you want to create a new artist with the following details?
            </DialogDescription>
          </DialogHeader>
          <div 
            className="space-y-2 py-2"
            style={{
              backgroundColor: isDark ? "#374151" : "#F9FAFB",
              padding: "12px",
              borderRadius: "8px",
              marginTop: "8px",
            }}
          >
            <p style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              <strong>Name:</strong> {formData.name || "—"}
            </p>
            <p style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              <strong>Email:</strong> {formData.email || "—"}
            </p>
            {formData.phone && (
              <p style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
                <strong>Phone:</strong> {formData.phone}
              </p>
            )}
            <p style={{ color: isDark ? "#FFFFFF" : "#1F2937" }}>
              <strong>Address:</strong> {formData.address}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAddOpen(false)}
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1D5DB",
                color: isDark ? "#FFFFFF" : "#1F2937",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAddArtist}
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
              Confirm Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

