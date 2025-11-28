"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Users, Shield, User, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "artist";
  created_at: string;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<"admin" | "artist">("artist");
  const [updating, setUpdating] = useState(false);

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
      fetchUsers();
    }
  }, [user]);

  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && data.users) {
        setUsers(data.users);
      } else {
        throw new Error(data.error || "Failed to fetch users");
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openRoleDialog = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setNewRole(userProfile.role);
    setRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      setUpdating(true);
      const token = await getAuthToken();
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: newRole,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `User role updated to ${newRole}`,
        });
        setRoleDialogOpen(false);
        setSelectedUser(null);
        await fetchUsers();
      } else {
        throw new Error(data.error || "Failed to update user role");
      }
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const isAdmin = role === "admin";
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
          isAdmin
            ? "bg-purple-100 text-purple-800"
            : "bg-blue-100 text-blue-800"
        }`}
      >
        {isAdmin ? (
          <Shield className="w-3 h-3" />
        ) : (
          <User className="w-3 h-3" />
        )}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#64748B" }} />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8" style={{ color: "#0F172A" }} />
          <h1
            className="text-3xl font-bold"
            style={{ color: "#0F172A" }}
          >
            User Management
          </h1>
        </div>
        <p style={{ color: "#64748B" }}>
          Manage user accounts and permissions
        </p>
      </div>

      {/* Users Table Card */}
      <div
        className="rounded-lg shadow-md border overflow-hidden"
        style={{
          backgroundColor: "#FFFFFF",
          borderColor: "#E2E8F0",
        }}
      >
        <div
          className="p-6 border-b"
          style={{
            borderColor: "#E2E8F0",
            backgroundColor: "#F8FAFC",
          }}
        >
          <h2
            className="text-xl font-semibold"
            style={{ color: "#0F172A" }}
          >
            All Users
          </h2>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {users.length} registered {users.length === 1 ? "user" : "users"}
          </p>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12" style={{ color: "#64748B" }}>
            <Users className="w-12 h-12 mx-auto mb-4" style={{ color: "#CBD5E1" }} />
            <p>No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ color: "#475569" }}>Email</TableHead>
                  <TableHead style={{ color: "#475569" }}>Role</TableHead>
                  <TableHead style={{ color: "#475569" }}>Joined</TableHead>
                  <TableHead className="text-right" style={{ color: "#475569" }}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userProfile) => (
                  <TableRow
                    key={userProfile.id}
                    className="transition-colors duration-200 hover:bg-slate-50"
                  >
                    <TableCell
                      className="font-medium"
                      style={{ color: "#0F172A" }}
                    >
                      {userProfile.email}
                      {userProfile.id === user?.id && (
                        <span
                          className="ml-2 text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "#E2E8F0",
                            color: "#64748B",
                          }}
                        >
                          You
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getRoleBadge(userProfile.role)}</TableCell>
                    <TableCell style={{ color: "#64748B" }}>
                      {new Date(userProfile.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoleDialog(userProfile)}
                        disabled={userProfile.id === user?.id}
                        className="flex items-center gap-2 transition-all duration-200 hover:bg-slate-100"
                        style={{
                          borderColor: "#E2E8F0",
                          color: userProfile.id === user?.id ? "#CBD5E1" : "#475569",
                        }}
                      >
                        Change Role
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: "#E2E8F0",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#0F172A" }}>Change User Role</DialogTitle>
            <DialogDescription style={{ color: "#64748B" }}>
              Update the role for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: "#475569" }}
            >
              Select Role
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setNewRole("artist")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 ${
                  newRole === "artist"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
                style={{
                  color: newRole === "artist" ? "#1D4ED8" : "#475569",
                }}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Artist</span>
              </button>
              <button
                type="button"
                onClick={() => setNewRole("admin")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 ${
                  newRole === "admin"
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
                style={{
                  color: newRole === "admin" ? "#7C3AED" : "#475569",
                }}
              >
                <Shield className="w-5 h-5" />
                <span className="font-medium">Admin</span>
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleDialogOpen(false);
                setSelectedUser(null);
              }}
              className="transition-all duration-200"
              style={{
                borderColor: "#E2E8F0",
                color: "#475569",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updating || newRole === selectedUser?.role}
              className="transition-all duration-200"
              style={{
                backgroundColor: "#0F172A",
                color: "#FFFFFF",
              }}
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
