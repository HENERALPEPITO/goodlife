"use client";

import React from "react";

type InvoiceStatusType = "pending" | "approved" | "rejected" | "paid";

interface DarkInvoiceStatusBadgeProps {
  status: InvoiceStatusType;
  className?: string;
}

/**
 * Dark Mode Invoice Status Badge Component
 * 
 * Status colors for dark mode:
 * - Pending → background: rgba(234, 179, 8, 0.15); text: #FACC15
 * - Paid → background: rgba(34, 197, 94, 0.15); text: #22C55E
 * - Approved → background: rgba(34, 197, 94, 0.15); text: #22C55E
 * - Rejected → background: rgba(239, 68, 68, 0.15); text: #EF4444
 */
const darkStatusConfig: Record<
  InvoiceStatusType,
  {
    bg: string;
    text: string;
    label: string;
  }
> = {
  pending: {
    bg: "rgba(234, 179, 8, 0.15)",  // Amber with transparency
    text: "#FACC15", // Bright amber/yellow
    label: "Pending",
  },
  approved: {
    bg: "rgba(34, 197, 94, 0.15)",  // Green with transparency
    text: "#22C55E", // Bright green
    label: "Approved",
  },
  rejected: {
    bg: "rgba(239, 68, 68, 0.15)",  // Red with transparency
    text: "#EF4444", // Bright red
    label: "Rejected",
  },
  paid: {
    bg: "rgba(34, 197, 94, 0.15)",  // Green with transparency
    text: "#22C55E", // Bright green
    label: "Paid",
  },
};

export default function DarkInvoiceStatusBadge({ status, className = "" }: DarkInvoiceStatusBadgeProps) {
  const config = darkStatusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center justify-center
        text-xs font-medium
        px-3 py-1
        rounded-full
        transition-all duration-200 ease-in-out
        ${className}
      `}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        fontSize: "0.85rem",
        padding: "4px 12px",
      }}
      onMouseEnter={(e) => {
        // Slight glow effect on hover
        e.currentTarget.style.boxShadow = `0 0 8px ${config.text}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {config.label}
    </span>
  );
}












