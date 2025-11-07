import Papa from "papaparse";

export const REQUIRED_HEADERS = [
  "Song Title",
  "Composer Name",
  "ISRC",
  "Artist",
  "Split",
] as const;

export type CatalogCsvRow = {
  [K in typeof REQUIRED_HEADERS[number]]: string;
};

export interface CatalogCsvParseResult {
  rows: CatalogCsvRow[];
  errors: string[];
}

export function validateHeaders(headers: string[]): string[] {
  const missing = REQUIRED_HEADERS.filter(
    (h) => !headers.some((x) => x.trim().toLowerCase() === h.toLowerCase())
  );
  return missing;
}

export function normalizeRow(raw: Record<string, any>): CatalogCsvRow {
  const get = (key: string) => raw[key] ?? raw[key.trim()] ?? "";
  return {
    "Song Title": String(get("Song Title") || "").trim(),
    "Composer Name": String(get("Composer Name") || "").trim(),
    ISRC: String(get("ISRC") || "").trim(),
    Artist: String(get("Artist") || "").trim(),
    Split: String(get("Split") || "").trim(),
  };
}

export function parseSplitPercent(split: string): number {
  const cleaned = split.replace(/%/g, "").trim();
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export async function parseCatalogCsv(file: File, expectedArtistName?: string): Promise<CatalogCsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const errors: string[] = [];
          const headers: string[] = results.meta.fields || [];
          const missing = validateHeaders(headers);
          if (missing.length > 0) {
            errors.push(`Missing required columns: ${missing.join(", ")}`);
            resolve({ rows: [], errors });
            return;
          }

          const rows: CatalogCsvRow[] = [];
          (results.data as Record<string, any>[]).forEach((raw, index) => {
            const row = normalizeRow(raw);
            
            // Skip empty rows
            if (!row["Song Title"] && !row.ISRC) {
              return;
            }

            // Validate ISRC is not empty - skip this row if invalid
            if (!row.ISRC || row.ISRC.trim() === "") {
              errors.push(`Row ${index + 2}: ISRC cannot be empty`);
              return; // Skip this row
            }

            // Validate Artist name matches (warning, not error) - but still include the row
            if (expectedArtistName && row.Artist && row.Artist.trim() !== expectedArtistName.trim()) {
              errors.push(`Row ${index + 2}: Artist name "${row.Artist}" does not match selected artist "${expectedArtistName}" (warning only)`);
            }

            // Only add valid rows (with ISRC)
            rows.push(row);
          });

          // If there are critical errors (missing columns or empty ISRCs), fail
          const criticalErrors = errors.filter(e => !e.includes("does not match") && !e.includes("warning only"));
          if (criticalErrors.length > 0) {
            resolve({ rows: [], errors: criticalErrors });
            return;
          }

          resolve({ rows, errors });
        } catch (e: any) {
          reject(e);
        }
      },
      error: (error) => reject(error),
    });
  });
}
