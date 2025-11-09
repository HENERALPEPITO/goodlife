"use client";

import React from "react";

type InvoiceStatusType = "pending" | "approved" | "rejected" | "paid";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatusType;
  className?: string;
}

/**
 * Invoice Status Badge Component for White Mode
 * 
 * Status colors:
 * - Pending: bg-[#FEF9C3], text-[#92400E]
 * - Approved: bg-[#DCFCE7], text-[#166534]
 * - Rejected: bg-[#FEE2E2], text-[#991B1B]
 * - Paid: bg-[#DCFCE7], text-[#166534] (same as approved)
 */
const statusConfig: Record<
  InvoiceStatusType,
  {
    bg: string;
    text: string;
    label: string;
  }
> = {
  pending: {
    bg: "#FEF9C3",  // Light yellow
    text: "#92400E", // Dark amber
    label: "Pending",
  },
  approved: {
    bg: "#DCFCE7",  // Light green
    text: "#166534", // Dark green
    label: "Approved",
  },
  rejected: {
    bg: "#FEE2E2",  // Light red
    text: "#991B1B", // Dark red
    label: "Rejected",
  },
  paid: {
    bg: "#DCFCE7",  // Light green
    text: "#166534", // Dark green
    label: "Paid",
  },
};

export default function InvoiceStatusBadge({ status, className = "" }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center justify-center
        text-xs font-medium
        px-3 py-1
        rounded-full
        transition-all duration-200 ease-in-out
        shadow-sm
        ${className}
      `}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.08)",
      }}
      onMouseEnter={(e) => {
        // Slight elevation on hover
        e.currentTarget.style.boxShadow = "0px 2px 4px rgba(0, 0, 0, 0.12)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0px 1px 3px rgba(0, 0, 0, 0.08)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {config.label}
    </span>
  );
}












