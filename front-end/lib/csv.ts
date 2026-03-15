// src/lib/csv.ts
// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED CSV parser for Maximo PM Open Activities exports.
//
// Serves BOTH sub-systems:
//   • drt-nextjs risk tracker  — uses parseCsv, latestRowByAlias, toNumber, safeParseDate
//   • drt-dashboard            — uses parseCsv, csvToPMRecords, deduplicateByAlias,
//                                rowToPMRecord, toNum, toDate
//
// All exports from the old split files are preserved so neither system needs
// changes to its import lines — they just point at this one file.
// ─────────────────────────────────────────────────────────────────────────────

import {
  GarageLocation,
  RiskLevel,
  type MaintenanceCsvRow,
  type PMRecord,
} from "./types";

import { serviceLevelFromJobPlan } from "./partsCatalogue";

// ════════════════════════════════════════════════════════════════════════════
// LOW-LEVEL PARSING
// ════════════════════════════════════════════════════════════════════════════

const MAXIMO_TYPE_HINTS = new Set(["string", "float", "integer", "datetime"]);

/**
 * Splits one CSV line into fields, respecting RFC-4180 double-quote escaping.
 * Exported as both `parseCsvLine` (nextjs name) and used internally as `parseLine`.
 */
export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i] as string;
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

// Internal alias used below — keeps the dashboard code readable
const parseLine = parseCsvLine;

/**
 * Returns true when every cell in a row matches a Maximo type-hint keyword.
 * Used to skip the second header row that Maximo exports.
 * Exported as both `isMaximoTypeRow` (nextjs) and `isTypeRow` (dashboard alias).
 */
export function isMaximoTypeRow(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => MAXIMO_TYPE_HINTS.has(cell.trim().toLowerCase()))
  );
}

/** Alias kept for dashboard compatibility. */
export const isTypeRow = isMaximoTypeRow;

// ════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL PARSE  (shared by both systems)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Parses a full CSV text string into an array of row objects.
 *   - Row 0  → headers (lowercased keys)
 *   - Row 1  → skipped when it looks like a Maximo type-hint row
 *   - Row 2+ → one object per non-empty line
 */
export function parseCsv(csvText: string): MaintenanceCsvRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];

  const headers = parseLine(firstLine).map((h) => h.toLowerCase());

  const secondLine = lines[1];
  const dataStart =
    secondLine && isMaximoTypeRow(parseLine(secondLine)) ? 2 : 1;

  return lines.slice(dataStart).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j] as string] = values[j] ?? "";
    }
    return row as MaintenanceCsvRow;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// FIELD COERCION HELPERS
// Both naming conventions exported so neither system needs changes.
// ════════════════════════════════════════════════════════════════════════════

/** Parses a string to a finite number. Returns 0 on failure. (nextjs name) */
export function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Alias used by dashboard code. */
export const toNum = toNumber;

/** Parses a date string. Returns null when invalid or empty. (nextjs name) */
export function safeParseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Alias used by dashboard code. */
export const toDate = safeParseDate;

// ════════════════════════════════════════════════════════════════════════════
// DEDUPLICATION
// Both naming conventions exported.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Returns a Map<alias, row> keeping only the row with the most recent
 * `reportdate` for each bus alias. Rows without an alias are discarded.
 * (nextjs name — used by risk.ts)
 */
export function latestRowByAlias(
  rows: MaintenanceCsvRow[]
): Map<string, MaintenanceCsvRow> {
  const out = new Map<string, MaintenanceCsvRow>();

  for (const row of rows) {
    const alias = row["alias"] ?? "";
    if (!alias) continue;

    const existing = out.get(alias);
    if (!existing) { out.set(alias, row); continue; }

    const existingDate = safeParseDate(existing["reportdate"] ?? "");
    const rowDate      = safeParseDate(row["reportdate"] ?? "");

    if (!existingDate || (rowDate && rowDate > existingDate)) {
      out.set(alias, row);
    }
  }

  return out;
}

/**
 * Same logic, returns an array instead of a Map.
 * (dashboard name — used by csvToPMRecords)
 */
export function deduplicateByAlias(
  rows: MaintenanceCsvRow[]
): MaintenanceCsvRow[] {
  return Array.from(latestRowByAlias(rows).values());
}

// ════════════════════════════════════════════════════════════════════════════
// PMRecord builder  (dashboard-specific — risk tracker uses risk.ts instead)
// ════════════════════════════════════════════════════════════════════════════

function normaliseLocation(loc: string): GarageLocation {
  const u = loc.toUpperCase();
  if (u.includes("RALEIGH")) return GarageLocation.Raleigh;
  if (u.includes("WESTNEY")) return GarageLocation.Westney;
  return GarageLocation.Unknown;
}

const KM_PER_DAY = 71;

function scoreRisk(
  unitsLate: number,
  daysLate: number,
  tolerance: number,
  status: string
): { level: RiskLevel; score: number } {
  if (status.toUpperCase() === "DOWN")
    return { level: RiskLevel.Critical, score: Math.max(unitsLate, tolerance) };
  if (unitsLate > tolerance || daysLate > 14)
    return { level: RiskLevel.Critical, score: Math.max(unitsLate, daysLate * KM_PER_DAY) };
  if (unitsLate > tolerance * 0.5 || daysLate > 7)
    return { level: RiskLevel.Warning, score: unitsLate };
  return { level: RiskLevel.Stable, score: unitsLate };
}

/** Converts a raw CSV row into a fully typed PMRecord. */
export function rowToPMRecord(row: MaintenanceCsvRow): PMRecord {
  const unitsLate  = toNumber(row["unitslate"]);
  const daysLate   = toNumber(row["dayslate"]);
  const tolerance  = toNumber(row["tolerance"]);
  const assetStatus = row["assetstatus"] ?? "";
  const { level, score } = scoreRisk(unitsLate, daysLate, tolerance, assetStatus);

  return {
    alias:              row["alias"]            ?? "",
    pmNum:              row["pmnum"]            ?? "",
    pmDescription:      row["pmdescription"]    ?? "",
    jobPlanDescription: row["jpdescription"]    ?? "",
    currentJobPlan:     row["curjpdescription"] ?? "",
    workOrderNum:       row["wonum"]            ?? "",
    assetNum:           row["assetnum"]         ?? "",
    assetDescription:   row["assetdescription"] ?? "",
    location:           normaliseLocation(row["locdescription"] ?? ""),
    pmStatus:           row["pmstatus"]         ?? "",
    assetStatus,
    odometerKm:         toNumber(row["lastreading"]),
    nextTriggerKm:      toNumber(row["nexttrigger"]),
    kmToNext:           toNumber(row["unitstogo"]),
    frequency:          toNumber(row["frequency"]),
    tolerance,
    unitsLate,
    daysLate,
    lastPMReading:      toNumber(row["lastpmwogenread"]),
    reportDate:         safeParseDate(row["reportdate"]),
    riskLevel:          level,
    riskScore:          score,
  };
}

/**
 * Full pipeline: raw CSV text → deduped, typed, sorted PMRecord[].
 * Used by the dashboard's /api/parse-csv route and the bus detail hooks.
 */
export function csvToPMRecords(text: string): PMRecord[] {
  const rows   = parseCsv(text);
  const deduped = deduplicateByAlias(rows);
  return deduped
    .map(rowToPMRecord)
    .filter((r) => r.alias)
    .sort((a, b) =>
      a.alias.localeCompare(b.alias, undefined, { numeric: true })
    );
}
