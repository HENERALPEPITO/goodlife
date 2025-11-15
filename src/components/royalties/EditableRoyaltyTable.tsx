"use client";

import { useState } from "react";
import { Royalty } from "@/types";
import { Trash2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface EditableRoyaltyTableProps {
  royalties: Royalty[];
  onUpdate: (id: string, data: Partial<Royalty>) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

interface EditingCell {
  royaltyId: string;
  field: keyof Royalty;
  value: string;
}

export function EditableRoyaltyTable({
  royalties,
  onUpdate,
  onDelete,
  isLoading = false,
}: EditableRoyaltyTableProps) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const handleCellClick = (royaltyId: string, field: keyof Royalty) => {
    const royalty = royalties.find((r) => r.id === royaltyId);
    if (royalty) {
      setEditingCell({
        royaltyId,
        field,
        value: String(royalty[field] || ""),
      });
    }
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;

    const royalty = royalties.find((r) => r.id === editingCell.royaltyId);
    if (!royalty) return;

    // Determine the field type and convert value appropriately
    let convertedValue: string | number = editingCell.value;
    const field = editingCell.field;

    if (
      field === "usage_count" ||
      field === "gross_amount" ||
      field === "admin_percent" ||
      field === "net_amount"
    ) {
      convertedValue = parseFloat(editingCell.value);
      if (isNaN(convertedValue)) {
        toast({
          title: "Invalid Input",
          description: "Please enter a valid number",
          variant: "destructive",
        });
        return;
      }
    }

    // Only update if value changed
    if (convertedValue === royalty[field]) {
      setEditingCell(null);
      return;
    }

    onUpdate(editingCell.royaltyId, { [field]: convertedValue });
    setEditingCell(null);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    return `€${Number(value).toFixed(2)}`;
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    return `${Number(value).toFixed(1)}%`;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    try {
      return new Date(date).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return date;
    }
  };

  const EditableCell = ({
    royaltyId,
    field,
    value,
  }: {
    royaltyId: string;
    field: keyof Royalty;
    value: string | number | null | undefined;
  }) => {
    const isEditing =
      editingCell?.royaltyId === royaltyId && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type={
              ["usage_count", "gross_amount", "admin_percent", "net_amount"].includes(
                field
              )
                ? "number"
                : "text"
            }
            value={editingCell.value}
            onChange={(e) =>
              setEditingCell({ ...editingCell, value: e.target.value })
            }
            onKeyDown={handleKeyDown}
            autoFocus
            className="px-2 py-1 border border-blue-300 rounded text-sm w-full max-w-xs"
            disabled={isLoading}
          />
          <button
            onClick={handleSaveEdit}
            disabled={isLoading}
            className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={isLoading}
            className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    // Format display value based on field type
    let displayValue: string = String(value);
    if (field === "gross_amount" || field === "net_amount") {
      displayValue = formatCurrency(typeof value === "number" ? value : null);
    } else if (field === "admin_percent") {
      displayValue = formatPercent(typeof value === "number" ? value : null);
    } else if (field === "broadcast_date") {
      displayValue = formatDate(typeof value === "string" ? value : null);
    } else if (value === null || value === undefined) {
      displayValue = "—";
    }

    return (
      <div
        onClick={() => handleCellClick(royaltyId, field)}
        className="cursor-pointer px-1 py-1 rounded hover:bg-blue-50 transition-colors"
      >
        {displayValue}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Song Title
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Source
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Territory
            </th>
            <th className="px-4 py-3 text-center font-semibold text-slate-900">
              Usage Count
            </th>
            <th className="px-4 py-3 text-right font-semibold text-slate-900">
              Gross
            </th>
            <th className="px-4 py-3 text-center font-semibold text-slate-900">
              Admin %
            </th>
            <th className="px-4 py-3 text-right font-semibold text-slate-900">
              Net
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Date
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              ISWC
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Composer
            </th>
            <th className="px-4 py-3 text-center font-semibold text-slate-900">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {royalties.map((royalty, idx) => (
            <tr
              key={royalty.id}
              className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
            >
              <td className="px-4 py-3 text-slate-900">
                <EditableCell
                  royaltyId={royalty.id}
                  field="track_title"
                  value={royalty.track_title}
                />
              </td>
              <td className="px-4 py-3 text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="exploitation_source_name"
                  value={royalty.exploitation_source_name}
                />
              </td>
              <td className="px-4 py-3 text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="territory"
                  value={royalty.territory}
                />
              </td>
              <td className="px-4 py-3 text-center text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="usage_count"
                  value={royalty.usage_count}
                />
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="gross_amount"
                  value={royalty.gross_amount}
                />
              </td>
              <td className="px-4 py-3 text-center text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="admin_percent"
                  value={royalty.admin_percent}
                />
              </td>
              <td className="px-4 py-3 text-right text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="net_amount"
                  value={royalty.net_amount}
                />
              </td>
              <td className="px-4 py-3 text-slate-700">
                <EditableCell
                  royaltyId={royalty.id}
                  field="broadcast_date"
                  value={royalty.broadcast_date}
                />
              </td>
              <td className="px-4 py-3 text-slate-700 text-xs">
                {royalty.track_id || "—"}
              </td>
              <td className="px-4 py-3 text-slate-700 text-xs">
                {royalty.payment_request_id || "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onDelete(royalty.id)}
                  disabled={isLoading}
                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Delete row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
