"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PaymentRequestConfirmationModalProps {
  balance: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

export function PaymentRequestConfirmationModal({
  balance,
  onConfirm,
  onCancel,
}: PaymentRequestConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Confirm Payment Request
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            Are you sure you want to request payment? This will request your full unpaid amount and reset your balance to €0.
          </p>
          <p className="text-sm text-gray-600 mb-6">
            <span className="font-bold text-lg text-gray-900">
              €{balance.toFixed(2)}
            </span> will be requested. An invoice will be automatically generated as a receipt.
          </p>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(balance)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              ✅ Confirm Request
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

