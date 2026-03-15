// ─────────────────────────────────────────────────────────────────────────────
// types.ts — DRT Fleet Risk Tracker
// All domain types, enums, and interfaces for the maintenance risk system.
// ─────────────────────────────────────────────────────────────────────────────

/** Raw key-value row from a parsed CSV file. Keys are lowercased header names. */
export type MaintenanceCsvRow = Readonly<Record<string, string>>;

// ── Enums ────────────────────────────────────────────────────────────────────

export enum RiskLevel {
  CRITICAL = "CRITICAL",
  WARNING = "WARNING",
  STABLE = "STABLE",
}

export enum AssetType {
  CONVENTIONAL_BUS = "CONVENTIONAL_BUS",
  NON_CONVENTIONAL_ASSET = "NON_CONVENTIONAL_ASSET",
}

export enum DataFreshness {
  CURRENT = "CURRENT",
  STALE = "STALE",
  MISSING = "MISSING",
}

export enum AssetStatus {
  ACTIVE = "ACTIVE",
  OPERATING = "OPERATING",
  DOWN = "DOWN",
  UNKNOWN = "UNKNOWN",
}

export enum GarageLocation {
  Raleigh = "Raleigh",
  Westney = "Westney",
  Unknown = "Unknown",
}

// ── Core vehicle model ────────────────────────────────────────────────────────

/** Normalised, typed representation of a single transit vehicle from the CSV. */
export interface TransitVehicle {
  /** Bus number / asset alias (e.g. "8592") */
  readonly alias: string;
  /** Year / Make / Model string (e.g. "2014 - CONVENTIONAL NEW FLYER - 8592") */
  readonly assetDescription: string;
  /** Kilometres past the scheduled service trigger */
  readonly unitsLate: number;
  /** Calendar days past the scheduled service date */
  readonly daysLate: number;
  /** Allowed buffer before escalation (usually 1 000 km) */
  readonly tolerance: number;
  /** Odometer reading at which the next PM triggers */
  readonly nextTrigger: number;
  /** Current odometer reading */
  readonly lastReading: number;
  readonly location: GarageLocation;
  readonly status: AssetStatus;
}

// ── Risk scoring ──────────────────────────────────────────────────────────────

export interface RiskProfile {
  readonly score: number;
  readonly level: RiskLevel;
  readonly label: string;
}

// ── Full enriched asset record ────────────────────────────────────────────────

export interface BusRiskDetails {
  readonly busNumber: string;
  readonly assetDescription: string;
  readonly assetType: AssetType;
  readonly isConventionalBus: boolean;
  readonly location: GarageLocation;
  readonly assetStatus: AssetStatus;
  readonly reportDate: Date | null;

  // Odometer / service window
  readonly odometerKm: number;
  readonly nextServiceKm: number;
  /** Remaining km until PM trigger (can be negative when overdue) */
  readonly kmToNextService: number;

  // Lateness
  readonly unitsLate: number;
  readonly daysOverdue: number;
  readonly toleranceKm: number;

  // Risk
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly riskLabel: string;
  /** unitsLate ÷ tolerance */
  readonly riskRatio: number;
  /** How far past the hard tolerance (0 when within tolerance) */
  readonly overToleranceByKm: number;

  // Asset age
  readonly yearBuilt: number | null;
  readonly ageYears: number | null;

  // Job plan tracking
  readonly currentJobPlan: string;
  readonly nextJobPlan: string;

  // Delta vs previous snapshot (null when no previous data available)
  readonly unitsLateDelta: number | null;
  readonly daysLateDelta: number | null;

  // Data quality
  readonly dataFreshness: DataFreshness;
  readonly dataGaps: readonly string[];
  readonly riskFactors: readonly string[];
}

// ── Aggregate summaries ───────────────────────────────────────────────────────

export interface DepotRiskSummary {
  readonly location: GarageLocation;
  readonly totalAssets: number;
  readonly critical: number;
  readonly warning: number;
  readonly stable: number;
  readonly avgDaysOverdue: number;
}

export interface FleetRiskSummary {
  readonly totalAssets: number;
  readonly critical: number;
  readonly warning: number;
  readonly stable: number;
  /** Percentage of assets where unitsLate > 0 */
  readonly overduePercent: number;
}

export interface BusRiskReport {
  readonly assets: readonly BusRiskDetails[];
  readonly fleet: FleetRiskSummary;
  readonly depots: readonly DepotRiskSummary[];
}

// ── UI / filter types ─────────────────────────────────────────────────────────

export type RiskFilterValue = RiskLevel | "ALL";

export interface FilterState {
  readonly query: string;
  readonly riskLevel: RiskFilterValue;
}

/** Config passed into the UI renderer */
export interface AppConfig {
  readonly csvPaths: CsvPaths;
  readonly asOfDate: Date;
}

export interface CsvPaths {
  readonly current: string;
  readonly previous: string;
}

export enum ServiceLevel {
  A = "A",
  B = "B",
  C = "C",
  D = "D",
}

export enum BusManufacturer {
  NewFlyer  = "New Flyer",
  Nova      = "Nova",
  Admin     = "Admin",
  Unknown   = "Unknown",
}

export enum MaintenanceStatus {
  Pending    = "PENDING",
  InProgress = "IN_PROGRESS",
  Complete   = "COMPLETE",
  Overdue    = "OVERDUE",
  Cancelled  = "CANCELLED",
}

export enum RiskLevel {
  Critical = "CRITICAL",
  Warning  = "WARNING",
  Stable   = "STABLE",
}



// ── Parts catalogue (from PDF) ────────────────────────────────────────────────

/** A single part required for a service level on a specific bus range. */
export interface ServicePart {
  readonly partName: string;
  readonly partNumber: string;      // e.g. "LFP3000XL", "LAF2100"
  readonly quantity?: number;
  readonly unit?: string;           // e.g. "litres", "each"
  readonly notes?: string;          // e.g. "x2", "with EMP"
  readonly serviceLevel: ServiceLevel[];  // which service levels require this part
}

/** All service requirements for a specific bus range, derived from the PDF. */
export interface BusServiceSpec {
  readonly manufacturer: BusManufacturer;
  readonly rangeLabel: string;      // e.g. "0107-0115"
  readonly aliasMin: number;
  readonly aliasMax: number;
  readonly parts: ServicePart[];
  readonly notes?: string;
}

// ── Core bus / PM record (from CSV) ──────────────────────────────────────────

/** Raw key-value row from a parsed Maximo CSV. All keys are lowercased. */

/** Normalised PM record — one per bus alias (most recent reportdate wins). */
export interface PMRecord {
  readonly alias: string;                 // Bus number e.g. "8592"
  readonly pmNum: string;                 // e.g. "PM64356"
  readonly pmDescription: string;
  readonly jobPlanDescription: string;    // scheduled service type
  readonly currentJobPlan: string;        // current service type
  readonly workOrderNum: string;
  readonly assetNum: string;
  readonly assetDescription: string;
  readonly location: GarageLocation;
  readonly pmStatus: string;
  readonly assetStatus: string;
  readonly odometerKm: number;
  readonly nextTriggerKm: number;
  readonly kmToNext: number;
  readonly frequency: number;
  readonly tolerance: number;
  readonly unitsLate: number;
  readonly daysLate: number;
  readonly lastPMReading: number;
  readonly reportDate: Date | null;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
}

// ── Enriched bus record ───────────────────────────────────────────────────────

/** Full bus record combining PM data + parts spec + maintenance history. */
export interface BusRecord {
  readonly alias: string;
  readonly manufacturer: BusManufacturer;
  readonly rangeLabel: string;
  readonly assetDescription: string;
  readonly location: GarageLocation;
  readonly assetStatus: string;
  readonly pm: PMRecord;
  readonly serviceSpec: BusServiceSpec | null;
  readonly currentServiceLevel: ServiceLevel;
  readonly maintenanceHistory: MaintenanceEntry[];
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
}

// ── Maintenance entry (logged work) ──────────────────────────────────────────

/** A recorded maintenance event — can be historical or newly submitted. */
export interface MaintenanceEntry {
  readonly id: string;
  readonly busAlias: string;
  readonly serviceLevel: ServiceLevel;
  readonly status: MaintenanceStatus;
  readonly performedBy: string;
  readonly garage: GarageLocation;
  readonly odometerAtService: number;
  readonly scheduledDate: Date;
  readonly completedDate: Date | null;
  readonly partsUsed: UsedPart[];
  readonly notes: string;
  readonly workOrderNum: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UsedPart {
  readonly partNumber: string;
  readonly partName: string;
  readonly quantityUsed: number;
  readonly unit: string;
}

// ── Forms ─────────────────────────────────────────────────────────────────────

/** Fields for the "New Maintenance Entry" form. */
export interface NewMaintenanceEntryForm {
  busAlias: string;
  serviceLevel: ServiceLevel | "";
  status: MaintenanceStatus;
  performedBy: string;
  garage: GarageLocation | "";
  odometerAtService: number | "";
  scheduledDate: string;            // ISO date string for input[type=date]
  completedDate: string;
  partsUsed: UsedPartForm[];
  notes: string;
  workOrderNum: string;
}

export interface UsedPartForm {
  partNumber: string;
  partName: string;
  quantityUsed: number | "";
  unit: string;
}

/** Fields for the "Update Entry" form — identical shape but all required. */
export type UpdateMaintenanceEntryForm = NewMaintenanceEntryForm & {
  id: string;
};

// ── Dashboard state ───────────────────────────────────────────────────────────

export interface DashboardFilters {
  search: string;
  riskLevel: RiskLevel | "ALL";
  location: GarageLocation | "ALL";
  serviceLevel: ServiceLevel | "ALL";
  status: MaintenanceStatus | "ALL";
}

export interface FleetSummary {
  total: number;
  critical: number;
  warning: number;
  stable: number;
  overdueCount: number;
  byGarage: Record<GarageLocation, number>;
}

// ── Auto-fill warning ─────────────────────────────────────────────────────────

export interface AutofillOverride {
  field: keyof NewMaintenanceEntryForm;
  previousValue: string;
  newValue: string;
}
