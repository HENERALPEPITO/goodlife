"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PaymentRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Access Denied",
        description: "Please login to access this page.",
        variant: "destructive",
      });
      router.push("/login");
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (user) {
      fetchBalance();
      checkPendingRequest();
    }
  }, [user]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        setLoading(false);
        return;
      }

      // First, get the artist ID from the artists table
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

      // Call the database function to get unpaid royalties total
      const { data, error } = await supabase.rpc("get_unpaid_royalties_total", {
        artist_uuid: artist.id,
      });

      if (error) {
        console.error("Error fetching balance:", error);
        setBalance(0);
      } else {
        setBalance(Number(data || 0));
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingRequest = async () => {
    try {
      if (!user) return;

      // First, get the artist ID from the artists table
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError || !artist) {
        return;
      }

      // Check if there's a pending or approved request
      const { data, error } = await supabase
        .from("payment_requests")
        .select("id")
        .eq("artist_id", artist.id)
        .in("status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking pending request:", error);
        return;
      }

      setHasPendingRequest(!!data);
    } catch (error) {
      console.error("Error checking pending request:", error);
    }
  };

  const handleRequestPayment = async () => {
    if (!user) return;

    try {
      setRequesting(true);

      // First, get the artist ID from the artists table
      const { data: artist, error: artistError } = await supabase
        .from("artists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (artistError || !artist) {
        throw new Error("Artist record not found");
      }

      // Call the API to create payment request
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artist_id: artist.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create payment request");
      }

      toast({
        title: "Payment Request Created",
        description: "Your payment request has been submitted successfully.",
      });

      // Refresh balance and check for pending requests
      await fetchBalance();
      await checkPendingRequest();
      setConfirmOpen(false);

      // Redirect to payments page
      router.push("/artist/payments");
    } catch (error: any) {
      console.error("Error creating payment request:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create payment request",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const canRequest = balance >= 100 && !hasPendingRequest;
  const minBalance = 100;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <DollarSign className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Request Payment</h1>
        </div>
        <p className="text-slate-600">Request a payout for your unpaid royalties</p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Balance</h2>
          <div className="text-4xl font-bold text-green-600 mb-2">
            €{balance.toFixed(2)}
          </div>
          <p className="text-sm text-slate-600">
            Total unpaid royalties available for withdrawal
          </p>
        </div>

        {hasPendingRequest && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  You have a pending payment request
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Please wait for your current request to be processed before requesting another payment.
                </p>
              </div>
            </div>
          </div>
        )}

        {!canRequest && !hasPendingRequest && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-sm text-slate-600">
              You can request a payout once your balance reaches €{minBalance} or more.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Current balance: €{balance.toFixed(2)} / €{minBalance.toFixed(2)} required
            </p>
          </div>
        )}

        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={!canRequest}
          className="w-full"
          size="lg"
        >
          {canRequest ? (
            <>
              <DollarSign className="w-5 h-5 mr-2" />
              Request Payment
            </>
          ) : (
            "Request Payment"
          )}
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to request payment?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              This will withdraw your entire balance and reset it to €0.
            </p>
            <div className="bg-slate-50 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Amount to withdraw:</span>
                <span className="text-lg font-bold text-green-600">
                  €{balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={requesting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestPayment}
              disabled={requesting}
              className="bg-green-600 hover:bg-green-700"
            >
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

