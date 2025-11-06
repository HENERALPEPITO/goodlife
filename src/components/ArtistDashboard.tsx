"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { DollarSign, Music, TrendingUp, FileText } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { PaymentRequestCard } from "./PaymentRequestCard";

interface ArtistStats {
  totalRevenue: number;
  pendingRevenue: number;
  totalTracks: number;
  totalStreams: number;
}

export default function ArtistDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ArtistStats>({
    totalRevenue: 0,
    pendingRevenue: 0,
    totalTracks: 0,
    totalStreams: 0,
  });
  const [loading, setLoading] = useState(true);
  const [requestingPayment, setRequestingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      fetchArtistStats();
    }
  }, [user]);

  const fetchArtistStats = async () => {
    if (!user) return;

    try {
      // First, find the artist record for this user
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError) {
        console.error("Error fetching artist:", artistError);
        setLoading(false);
        return;
      }

      if (!artist) {
        console.warn("No artist found for user");
        setStats({
          totalRevenue: 0,
          pendingRevenue: 0,
          totalTracks: 0,
          totalStreams: 0,
        });
        setLoading(false);
        return;
      }

      // Query tracks using the artist ID (not user ID)
      const { count: trackCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true })
        .eq("artist_id", artist.id);

      const { data: royalties } = await supabase
        .from("royalties")
        .select("net_amount, usage_count")
        .eq("artist_id", artist.id)
        .eq("is_paid", false);

      const totalRevenue = royalties?.reduce(
        (sum, r) => sum + Number(r.net_amount || 0),
        0
      ) || 0;

      const totalStreams = royalties?.reduce(
        (sum, r) => sum + Number(r.usage_count || 0),
        0
      ) || 0;

      const { data: pendingRequests } = await supabase
        .from("payment_requests")
        .select("amount")
        .eq("artist_id", artist.id)
        .eq("status", "pending");

      const pendingRevenue = pendingRequests?.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      ) || 0;

      setStats({
        totalRevenue,
        pendingRevenue,
        totalTracks: trackCount || 0,
        totalStreams,
      });
    } catch (error) {
      console.error("Error fetching artist stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!user) return;

    setRequestingPayment(true);
    try {
      const availableBalance = stats.totalRevenue - stats.pendingRevenue;

      if (availableBalance <= 0) {
        toast({
          title: "No funds available",
          description: "You don't have any available balance to request.",
          variant: "destructive",
        });
        return;
      }

      // Get artist ID first
      const { data: artist } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!artist) {
        toast({
          title: "Error",
          description: "Artist record not found.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("payment_requests").insert({
        artist_id: artist.id,
        amount: availableBalance,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Payment requested",
        description: `Successfully requested payment of $${availableBalance.toFixed(2)}`,
      });

      await fetchArtistStats();
    } catch (error) {
      console.error("Error requesting payment:", error);
      toast({
        title: "Error",
        description: "Failed to request payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingPayment(false);
    }
  };

  const kpis = [
    {
      label: "Total Revenue",
      value: `€${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "All time earnings",
      icon: DollarSign,
      color: "#4ADE80",
    },
    {
      label: "Available Balance",
      value: `€${(stats.totalRevenue - stats.pendingRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "Ready to withdraw",
      icon: TrendingUp,
      color: "#60A5FA",
    },
    {
      label: "Total Streams",
      value: stats.totalStreams.toLocaleString(),
      sub: "All platforms",
      icon: TrendingUp,
      color: "#A78BFA",
    },
    {
      label: "Active Tracks",
      value: stats.totalTracks.toString(),
      sub: "In catalog",
      icon: Music,
      color: "#FB923C",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="transition-colors" style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold transition-colors" style={{ color: 'var(--text-primary)' }}>Artist Dashboard</h1>
        <p className="text-sm mt-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          Welcome back, {user?.email}!
        </p>
      </div>

      {/* Payment Request Card */}
      <PaymentRequestCard user={user} />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] cursor-default"
              style={{
                backgroundColor: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 8px 32px 0 var(--shadow)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</div>
                <Icon className="h-5 w-5" style={{ color: kpi.color }} />
              </div>
              <div className="mt-2 text-3xl font-semibold transition-colors" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
              <div className="text-xs mt-1 transition-colors" style={{ color: 'var(--text-muted)' }}>{kpi.sub}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/analytics"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <TrendingUp className="h-8 w-8 mb-3" style={{ color: 'var(--accent-blue)' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Analytics</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            View detailed performance metrics
          </p>
        </Link>

        <Link
          href="/royalties"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <FileText className="h-8 w-8 mb-3" style={{ color: '#10B981' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Royalties</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            View your royalty statements
          </p>
        </Link>

        <Link
          href="/catalog"
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] block"
          style={{
            backgroundColor: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 8px 32px 0 var(--shadow)',
          }}
        >
          <Music className="h-8 w-8 mb-3" style={{ color: '#A78BFA' }} />
          <h3 className="font-semibold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>Catalog</h3>
          <p className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
            Browse your track catalog
          </p>
        </Link>
      </section>

      {stats.pendingRevenue > 0 && (
        <section 
          className="backdrop-blur-md rounded-2xl p-6 transition-all duration-200"
          style={{
            backgroundColor: 'rgba(251, 146, 60, 0.1)',
            border: '1px solid rgba(251, 146, 60, 0.3)',
            boxShadow: '0 8px 32px 0 rgba(251, 146, 60, 0.2)',
          }}
        >
          <h2 className="text-lg font-semibold mb-2 transition-colors" style={{ color: '#FBBF24' }}>
            Pending Payment Request
          </h2>
          <p className="text-sm transition-colors" style={{ color: '#FCD34D' }}>
            You have a pending payment request of ${stats.pendingRevenue.toFixed(2)}. 
            Your admin will review and process it soon.
          </p>
        </section>
      )}
    </div>
  );
}
