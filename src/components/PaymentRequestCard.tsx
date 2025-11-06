"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { PaymentRequestConfirmationModal } from "./PaymentRequestConfirmationModal";

interface PaymentRequestCardProps {
  user: {
    id: string;
    role: string;
  };
}

export function PaymentRequestCard({ user }: PaymentRequestCardProps) {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [artistId, setArtistId] = useState<string | null>(null);

  const MINIMUM_BALANCE = 100;

  const fetchBalanceAndStatus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);

      // First, get the artist ID
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError || !artist) {
        console.error("Error fetching artist:", artistError);
        setBalance(0);
        setLoading(false);
        return;
      }

      setArtistId(artist.id);

      // Get unpaid royalties total
      const { data: royalties, error: royaltiesError } = await supabase
        .from("royalties")
        .select("net_amount")
        .eq("artist_id", artist.id)
        .eq("is_paid", false);

      if (royaltiesError) {
        console.error("Error fetching royalties:", royaltiesError);
        setBalance(0);
      } else {
        const total = royalties?.reduce((sum, r) => sum + Number(r.net_amount || 0), 0) || 0;
        setBalance(total);
      }

      // Check for pending/approved payment requests
      const { data: requests, error: requestsError } = await supabase
        .from("payment_requests")
        .select("id, status")
        .eq("artist_id", artist.id)
        .in("status", ["pending", "approved"]);

      if (requestsError) {
        console.error("Error fetching payment requests:", requestsError);
      } else {
        setHasPendingRequest((requests?.length || 0) > 0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBalanceAndStatus();
  }, [fetchBalanceAndStatus]);

  const handleRequestPayment = async (confirmedAmount: number) => {
    if (!artistId) {
      toast({
        title: "Error",
        description: "Artist record not found",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use API route to create payment request (which auto-generates invoice)
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { "Authorization": `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          amount: confirmedAmount,
          artist_id: artistId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create payment request");
      }

      toast({
        title: "Success",
        description: `✅ Payment request of €${confirmedAmount.toFixed(2)} submitted successfully. An invoice has been generated and is available in the Invoices section. Your balance has been reset to €0.`,
      });

      // Refresh balance and status
      await fetchBalanceAndStatus();
      setShowConfirmModal(false);
    } catch (error) {
      console.error("Error requesting payment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit payment request",
        variant: "destructive",
      });
    }
  };

  const canRequestPayment = balance >= MINIMUM_BALANCE && !hasPendingRequest && !loading;

  const getButtonTooltip = () => {
    if (hasPendingRequest) {
      return "You already have a pending payment request.";
    }
    if (balance < MINIMUM_BALANCE) {
      return `Minimum payout is €${MINIMUM_BALANCE}. You currently have €${balance.toFixed(2)}.`;
    }
    return "";
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Current Balance
            </h3>
            <div className="text-3xl font-bold text-gray-900">
              €{loading ? "..." : balance.toFixed(2)}
            </div>
            {hasPendingRequest && (
              <p className="text-sm text-amber-600 mt-2">
                ⚠️ You have a pending payment request
              </p>
            )}
          </div>
          <div>
            <Button
              onClick={() => setShowConfirmModal(true)}
              disabled={!canRequestPayment}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title={getButtonTooltip()}
            >
              Request Payment
            </Button>
          </div>
        </div>

        {!canRequestPayment && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-600">
              {hasPendingRequest
                ? "You already have a pending payment request. Please wait for admin approval."
                : balance < MINIMUM_BALANCE
                ? `Minimum payout is €${MINIMUM_BALANCE}. You currently have €${balance.toFixed(2)}.`
                : ""}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <PaymentRequestConfirmationModal
          balance={balance}
          onConfirm={handleRequestPayment}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </>
  );
}

