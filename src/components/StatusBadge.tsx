"use client";

import React from "react";

type StatusType = "pending" | "approved" | "rejected";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

/**
 * Status color configuration for white-mode theme
 * Designed with AA-compliant contrast ratios on white backgrounds
 */
const statusConfig: Record<
  StatusType,
  {
    bg: string;
    text: string;
    border: string;
    label: string;
  }
> = {
  pending: {
    bg: "#FFF7E0",  // Light cream background
    text: "#B45309", // Amber text
    border: "#FBBF24", // Gold border
    label: "Pending",
  },
  approved: {
    bg: "#DCFCE7",  // Light green background
    text: "#166534", // Dark green text
    border: "#22C55E", // Emerald border
    label: "Approved",
  },
  rejected: {
    bg: "#FEE2E2",  // Light red background
    text: "#B91C1C", // Dark red text
    border: "#EF4444", // Red border
    label: "Rejected",
  },
};

/**
 * Modern, minimalist status badge component for white-mode dashboards
 * 
 * Features:
 * - AA compliant contrast ratios
 * - Smooth color transitions
 * - Hover brightness effect
 * - Pill-shaped design
 * - Subtle shadow for depth
 */
export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center justify-center
        text-xs font-medium
        px-3 py-1
        rounded-full
        border
        transition-all duration-200 ease-in-out
        shadow-sm
        ${className}
      `}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
      onMouseEnter={(e) => {
        // Slightly increase brightness on hover
        const rgb = hexToRgb(config.bg);
        if (rgb) {
          const brightened = {
            r: Math.min(255, rgb.r + 8),
            g: Math.min(255, rgb.g + 8),
            b: Math.min(255, rgb.b + 8),
          };
          e.currentTarget.style.backgroundColor = `rgb(${brightened.r}, ${brightened.g}, ${brightened.b})`;
          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
        }
      }}
      onMouseLeave={(e) => {
        // Reset to original
        e.currentTarget.style.backgroundColor = config.bg;
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
      }}
    >
      {config.label}
    </span>
  );
}

/**
 * Helper function to convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Example usage in a table row:
 * 
 * <tr>
 *   <td>
 *     <StatusBadge status="pending" />
 *   </td>
 *   <td>
 *     <Button className="bg-green-600 hover:bg-green-700 text-white">
 *       Approve
 *     </Button>
 *   </td>
 *   <td>
 *     <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
 *       Reject
 *     </Button>
 *   </td>
 * </tr>
 */
