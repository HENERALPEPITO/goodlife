/**
 * MultiSelectToolbar Component
 * Toolbar displayed when rows are selected for bulk actions
 */

"use client";

import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

interface MultiSelectToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function MultiSelectToolbar({
  selectedCount,
  onDelete,
  onClearSelection,
}: MultiSelectToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-slate-900 text-white rounded-lg shadow-2xl border border-slate-700 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {selectedCount}
          </div>
          <span className="font-medium">
            {selectedCount === 1 ? "1 item selected" : `${selectedCount} items selected`}
          </span>
        </div>
        
        <div className="h-6 w-px bg-slate-700" />
        
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

