"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title?: string;
  error?: string | null;
}

export default function PDFPreviewModal({
  isOpen,
  onClose,
  pdfUrl,
  title = "Invoice Preview",
  error,
}: PDFPreviewModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIframeLoaded(false);
      setHasError(false);
      setLoadingTimeout(false);
    }
  }, [isOpen]);

  // Reset iframe loaded state when pdfUrl changes
  useEffect(() => {
    if (pdfUrl) {
      setIframeLoaded(false);
      setHasError(false);
      setLoadingTimeout(false);
      
      // Failsafe: if onLoad doesn't fire within 3 seconds, assume it loaded
      const timeout = setTimeout(() => {
        setIframeLoaded(true);
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [pdfUrl]);

  // Show timeout error if no pdfUrl after 15 seconds
  useEffect(() => {
    if (isOpen && !pdfUrl && !error) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
      }, 15000);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen, pdfUrl, error]);

  // Handle animation states
  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger enter animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
      setIframeLoaded(false);
      setHasError(false);
    }, 200);
  };

  const handleOpenFullPDF = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    }
  };

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  const handleIframeError = () => {
    setHasError(true);
    setIframeLoaded(true);
  };

  // Show loading if no pdfUrl yet OR if pdfUrl exists but iframe hasn't loaded
  const showLoading = !pdfUrl && !error && !loadingTimeout;
  const showPdfLoading = pdfUrl && !iframeLoaded && !hasError;

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={handleClose}
    >
      {/* Modal Content */}
      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-200 ease-out ${
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
        style={{
          border: "1px solid #E2E8F0",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{
            borderColor: "#E2E8F0",
            backgroundColor: "#F8FAFC",
          }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" style={{ color: "#475569" }} />
            <h2
              className="text-lg font-semibold"
              style={{ color: "#0F172A" }}
            >
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenFullPDF}
              disabled={!pdfUrl}
              className="flex items-center gap-2 transition-all duration-200 hover:bg-slate-100"
              style={{
                borderColor: "#E2E8F0",
                color: "#475569",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Open Full PDF
            </Button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-slate-200"
              style={{ color: "#64748B" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-hidden p-4 relative" style={{ minHeight: "70vh" }}>
          {/* Generating PDF loading state */}
          {showLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-white z-10 m-4 rounded-lg"
              style={{ border: "1px solid #E2E8F0" }}
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2
                  className="w-8 h-8 animate-spin"
                  style={{ color: "#64748B" }}
                />
                <p className="text-sm" style={{ color: "#64748B" }}>
                  Generating PDF...
                </p>
              </div>
            </div>
          )}

          {/* PDF loading state (after URL is set) */}
          {showPdfLoading && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-white z-10 m-4 rounded-lg"
              style={{ border: "1px solid #E2E8F0" }}
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2
                  className="w-8 h-8 animate-spin"
                  style={{ color: "#64748B" }}
                />
                <p className="text-sm" style={{ color: "#64748B" }}>
                  Loading PDF...
                </p>
              </div>
            </div>
          )}

          {/* Error state from prop */}
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="w-16 h-16" style={{ color: "#EF4444" }} />
              <p className="text-sm font-medium" style={{ color: "#EF4444" }}>
                Error
              </p>
              <p className="text-sm text-center max-w-md" style={{ color: "#64748B" }}>
                {error}
              </p>
            </div>
          )}

          {/* Timeout state */}
          {loadingTimeout && !pdfUrl && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="w-16 h-16" style={{ color: "#F59E0B" }} />
              <p className="text-sm font-medium" style={{ color: "#F59E0B" }}>
                Taking too long
              </p>
              <p className="text-sm text-center max-w-md" style={{ color: "#64748B" }}>
                PDF generation is taking longer than expected. Please check the browser console for errors or try again.
              </p>
            </div>
          )}

          {/* Iframe error state */}
          {hasError && !error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="w-16 h-16" style={{ color: "#EF4444" }} />
              <p className="text-sm" style={{ color: "#64748B" }}>
                Failed to display PDF. Try opening it in a new tab.
              </p>
            </div>
          )}

          {/* PDF viewer - use object tag which works better with blob URLs */}
          {pdfUrl && !hasError && !error && (
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full rounded-lg"
              style={{
                border: "1px solid #E2E8F0",
                minHeight: "calc(70vh - 2rem)",
                opacity: iframeLoaded ? 1 : 0,
              }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            >
              {/* Fallback for browsers that don't support object tag */}
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                style={{ minHeight: "calc(70vh - 2rem)" }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="PDF Preview"
              />
            </object>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-6 py-4 border-t gap-3"
          style={{
            borderColor: "#E2E8F0",
            backgroundColor: "#F8FAFC",
          }}
        >
          <Button
            variant="outline"
            onClick={handleClose}
            className="transition-all duration-200 hover:bg-slate-100"
            style={{
              borderColor: "#E2E8F0",
              color: "#475569",
            }}
          >
            Close
          </Button>
          <Button
            onClick={handleOpenFullPDF}
            disabled={!pdfUrl}
            className="transition-all duration-200"
            style={{
              backgroundColor: "#0F172A",
              color: "#FFFFFF",
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Full PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
