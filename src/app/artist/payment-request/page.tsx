"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PaymentDetails {
  name: string;
  surname: string;
  address: string;
  taxId: string;
  iban: string;
  swiftBic: string;
  bankName: string;
  bankAddress: string;
}

export default function PaymentRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>({
    name: "",
    surname: "",
    address: "",
    taxId: "",
    iban: "",
    swiftBic: "",
    bankName: "",
    bankAddress: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!user) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/data/balance?user_id=${user.id}`, { cache: "no-store" });
      const json = await res.json();

      if (json.error) {
        console.error("Error fetching balance:", json.error);
        setBalance(0);
      } else {
        setBalance(json.balance || 0);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkPendingRequest = useCallback(async () => {
    try {
      if (!user) return;

      const res = await fetch(`/api/data/pending-request?user_id=${user.id}`, { cache: "no-store" });
      const json = await res.json();

      if (json.error) {
        console.error("Error checking pending request:", json.error);
        return;
      }

      setHasPendingRequest(json.hasPendingRequest || false);
    } catch (error) {
      console.error("Error checking pending request:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBalance();
      checkPendingRequest();
    }
  }, [user, fetchBalance, checkPendingRequest]);

  const handleRequestPaymentClick = () => {
    // STEP 1: Open bank details modal (button is already disabled if conditions aren't met)
    setBankDetailsOpen(true);
  };

  const handleBankDetailsSubmit = () => {
    // Validate form before proceeding
    if (!validatePaymentForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    // STEP 2: Bank details are valid, close bank details modal and open confirmation modal
    setBankDetailsOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!user) return;

    try {
      setRequesting(true);

      // First, get the artist ID via API
      const balanceRes = await fetch(`/api/data/balance?user_id=${user.id}`, { cache: "no-store" });
      const balanceJson = await balanceRes.json();

      if (!balanceJson.artistId) {
        throw new Error("Artist record not found");
      }

      // Call the API to create payment request with payment details
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          artist_id: balanceJson.artistId,
          paymentDetails: paymentDetails,
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

      // Reset form
      setPaymentDetails({
        name: "",
        surname: "",
        address: "",
        taxId: "",
        iban: "",
        swiftBic: "",
        bankName: "",
        bankAddress: "",
      });
      setFormErrors({});

      // Redirect to payments page
      router.push("/artist/payments");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create payment request";
      console.error("Error creating payment request:", error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const canRequest = balance >= 100 && !hasPendingRequest;
  const minBalance = 100;

  const validatePaymentForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!paymentDetails.name.trim()) errors.name = "First name is required";
    if (!paymentDetails.surname.trim()) errors.surname = "Surname is required";
    if (!paymentDetails.address.trim()) errors.address = "Address is required";
    if (!paymentDetails.taxId.trim()) errors.taxId = "Tax ID is required";
    if (!paymentDetails.iban.trim()) errors.iban = "IBAN is required";
    if (!paymentDetails.swiftBic.trim()) errors.swiftBic = "SWIFT/BIC code is required";
    if (!paymentDetails.bankName.trim()) errors.bankName = "Bank name is required";
    if (!paymentDetails.bankAddress.trim()) errors.bankAddress = "Bank address is required";

    // Validate IBAN format (basic validation)
    if (paymentDetails.iban.trim() && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(paymentDetails.iban.toUpperCase())) {
      errors.iban = "Invalid IBAN format";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof PaymentDetails, value: string) => {
    setPaymentDetails(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ""
      }));
    }
  };

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
            ${balance.toFixed(2)}
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
              You can request a payout once your balance reaches ${minBalance} or more.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Current balance: ${balance.toFixed(2)} / ${minBalance.toFixed(2)} required
            </p>
          </div>
        )}

        <Button
          onClick={handleRequestPaymentClick}
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
            <>
              <DollarSign className="w-5 h-5 mr-2" />
              Request Payment (Balance: ${balance.toFixed(2)})
            </>
          )}
        </Button>
      </div>

      {/* STEP 1: Bank Details Modal */}
      <Dialog open={bankDetailsOpen} onOpenChange={setBankDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Information</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Personal Information Section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Personal Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-sm">Name *</Label>
                    <Input
                      id="name"
                      placeholder="Enter your first name"
                      value={paymentDetails.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className={formErrors.name ? "border-red-500" : ""}
                      disabled={requesting}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="surname" className="text-sm">Surname *</Label>
                    <Input
                      id="surname"
                      placeholder="Enter your surname"
                      value={paymentDetails.surname}
                      onChange={(e) => handleInputChange("surname", e.target.value)}
                      className={formErrors.surname ? "border-red-500" : ""}
                      disabled={requesting}
                    />
                    {formErrors.surname && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.surname}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="text-sm">Address *</Label>
                  <Input
                    id="address"
                    placeholder="Enter your full address"
                    value={paymentDetails.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    className={formErrors.address ? "border-red-500" : ""}
                    disabled={requesting}
                  />
                  {formErrors.address && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.address}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="taxId" className="text-sm">Tax ID *</Label>
                  <Input
                    id="taxId"
                    placeholder="Enter your tax ID"
                    value={paymentDetails.taxId}
                    onChange={(e) => handleInputChange("taxId", e.target.value)}
                    className={formErrors.taxId ? "border-red-500" : ""}
                    disabled={requesting}
                  />
                  {formErrors.taxId && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.taxId}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bank Details Section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Bank Details</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="iban" className="text-sm">IBAN *</Label>
                  <Input
                    id="iban"
                    placeholder="e.g., DE89370400440532013000"
                    value={paymentDetails.iban}
                    onChange={(e) => handleInputChange("iban", e.target.value.toUpperCase())}
                    className={formErrors.iban ? "border-red-500" : ""}
                    disabled={requesting}
                  />
                  {formErrors.iban && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.iban}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="swiftBic" className="text-sm">SWIFT / BIC Code *</Label>
                    <Input
                      id="swiftBic"
                      placeholder="e.g., DEUTDEDD"
                      value={paymentDetails.swiftBic}
                      onChange={(e) => handleInputChange("swiftBic", e.target.value.toUpperCase())}
                      className={formErrors.swiftBic ? "border-red-500" : ""}
                      disabled={requesting}
                    />
                    {formErrors.swiftBic && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.swiftBic}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="bankName" className="text-sm">Bank Name *</Label>
                    <Input
                      id="bankName"
                      placeholder="Enter your bank name"
                      value={paymentDetails.bankName}
                      onChange={(e) => handleInputChange("bankName", e.target.value)}
                      className={formErrors.bankName ? "border-red-500" : ""}
                      disabled={requesting}
                    />
                    {formErrors.bankName && (
                      <p className="text-xs text-red-500 mt-1">{formErrors.bankName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="bankAddress" className="text-sm">Bank Address *</Label>
                  <Input
                    id="bankAddress"
                    placeholder="Enter your bank's address"
                    value={paymentDetails.bankAddress}
                    onChange={(e) => handleInputChange("bankAddress", e.target.value)}
                    className={formErrors.bankAddress ? "border-red-500" : ""}
                    disabled={requesting}
                  />
                  {formErrors.bankAddress && (
                    <p className="text-xs text-red-500 mt-1">{formErrors.bankAddress}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBankDetailsOpen(false)}
              disabled={requesting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBankDetailsSubmit}
              disabled={requesting}
            >
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STEP 2: Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment Request</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to request a payment?
            </p>
            
            <p className="text-sm text-slate-700">
              This will withdraw your entire balance and reset it to $0.
            </p>

            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Amount to withdraw:</span>
                <span className="text-2xl font-bold text-green-600">
                  ${balance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={requesting}
            >
              Back
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={requesting}
              className="bg-green-600 hover:bg-green-700"
            >
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}