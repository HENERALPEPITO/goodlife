"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, ChevronDown, Loader } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface CsvUpload {
  id: string;
  filename: string;
  storage_path: string;
  year: number;
  quarter: number;
  file_size: number;
  row_count: number;
  processing_status: string;
  created_at: string;
  download_url?: string;
}

interface CsvExportDropdownProps {
  artistId: string;
}

export function CsvExportDropdown({ artistId }: CsvExportDropdownProps) {
  const { toast } = useToast();
  const [csvUploads, setCsvUploads] = useState<CsvUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch CSV uploads
  const fetchCsvUploads = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(`/api/admin/royalties/csv-exports/${artistId}`, {
        headers,
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setCsvUploads(data);
      } else {
        console.warn("Failed to fetch CSV uploads");
      }
    } catch (err) {
      console.error("Error fetching CSV uploads:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchCsvUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId]);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Download CSV from storage
  const downloadCsv = (upload: CsvUpload) => {
    if (!upload.download_url) {
      toast({
        title: "Error",
        description: "Download URL not available",
        variant: "destructive",
      });
      return;
    }

    const link = document.createElement("a");
    link.href = upload.download_url;
    link.download = upload.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsOpen(false);

    toast({
      title: "Download Started",
      description: `Downloading ${upload.filename}`,
    });
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader className="w-4 h-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (csvUploads.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <FileDown className="w-4 h-4" />
        Export Original CSV
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <p className="text-sm font-medium text-slate-700">
                Original Uploaded CSV Files
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Download the original CSV files from storage
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {csvUploads.map((upload) => (
                <button
                  key={upload.id}
                  onClick={() => downloadCsv(upload)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                      {upload.filename}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Q{upload.quarter} {upload.year} • {formatFileSize(upload.file_size)} • {upload.row_count?.toLocaleString() || 0} rows
                    </p>
                  </div>
                  <FileDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
