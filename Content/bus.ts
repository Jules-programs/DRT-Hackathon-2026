// Constructor for transit vehicles
// Model for the bus object and risk scoring output

interface MaintenanceCsvRow {
  [key: string]: string;
}

// The core vehicle definition
interface TransitVehicle {
  alias: string;                    // Bus Number (e.g., "8592")
  assetDescription: string;         // Year/Make/Model (e.g., "2014 New Flyer")
  unitsLate: number;                // KM past schedule
  daysLate: number;                 // Time past schedule
  tolerance: number;                // Allowed buffer (usually 1000)
  nextTrigger: number;              // Odometer target
  lastReading: number;              // Current Odometer
  location: 'Raleigh' | 'Westney' | 'Unknown'; // Garage site
  status: 'ACTIVE' | 'OPERATING' | 'DOWN' | 'UNKNOWN';
}

// The result of our risk calculation
enum RiskLevel {
  CRITICAL = 'CRITICAL', // Over tolerance or unavailable asset
  WARNING = 'WARNING',   // Approaching tolerance or overdue days
  STABLE = 'STABLE'      // Within limits
}

interface RiskProfile {
  score: number;
  level: RiskLevel;
  label: string;
}

interface BusRiskDetails {
  busNumber: string;
  assetDescription: string;
  assetType: 'CONVENTIONAL_BUS' | 'NON_CONVENTIONAL_ASSET';
  isConventionalBus: boolean;
  location: TransitVehicle['location'];
  assetStatus: TransitVehicle['status'];
  reportDate: Date | null;
  odometerKm: number;
  nextServiceKm: number;
  kmToNextService: number;
  unitsLate: number;
  daysOverdue: number;
  toleranceKm: number;
  riskLevel: RiskLevel;
  riskScore: number;
  riskLabel: string;
  riskRatio: number;
  overToleranceByKm: number;
  yearBuilt: number | null;
  ageYears: number | null;
  currentJobPlan: string;
  nextJobPlan: string;
  unitsLateDelta: number | null;
  daysLateDelta: number | null;
  dataFreshness: 'CURRENT' | 'STALE' | 'MISSING';
  dataGaps: string[];
  riskFactors: string[];
}

interface DepotRiskSummary {
  location: TransitVehicle['location'];
  totalAssets: number;
  critical: number;
  warning: number;
  stable: number;
  avgDaysOverdue: number;
}

interface FleetRiskSummary {
  totalAssets: number;
  critical: number;
  warning: number;
  stable: number;
  overduePercent: number;
}

interface BusRiskReport {
  assets: BusRiskDetails[];
  fleet: FleetRiskSummary;
  depots: DepotRiskSummary[];
}

const KNOWN_HEADER_TYPES = new Set(['string', 'float', 'integer', 'datetime']);

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const isTypeRow = (row: string[]): boolean => {
  if (row.length === 0) {
    return false;
  }
  return row.every((cell) => KNOWN_HEADER_TYPES.has(cell.trim().toLowerCase()));
};

const toNumber = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseReportDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeLocation = (locDescription: string): TransitVehicle['location'] => {
  const value = locDescription.toUpperCase();
  if (value.includes('RALEIGH')) {
    return 'Raleigh';
  }
  if (value.includes('WESTNEY')) {
    return 'Westney';
  }
  return 'Unknown';
};

const normalizeStatus = (status: string): TransitVehicle['status'] => {
  const value = status.trim().toUpperCase();
  if (value === 'DOWN' || value === 'OPERATING' || value === 'ACTIVE') {
    return value;
  }
  return 'UNKNOWN';
};

const isConventionalBus = (assetDescription: string, meterName: string): boolean => {
  const description = assetDescription.toUpperCase();
  const meter = meterName.toUpperCase();
  if (description.includes('ADMIN') || description.includes('UTV')) {
    return false;
  }
  return description.includes('CONVENTIONAL') || meter === 'ODOMETER';
};

const extractYear = (assetDescription: string): number | null => {
  const match = assetDescription.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

const freshnessFromDate = (reportDate: Date | null, asOfDate: Date): BusRiskDetails['dataFreshness'] => {
  if (!reportDate) {
    return 'MISSING';
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const deltaDays = (asOfDate.getTime() - reportDate.getTime()) / dayMs;
  return deltaDays <= 7 ? 'CURRENT' : 'STALE';
};

// Function to calculate risk based on distance and time lateness
const calculateVehicleRisk = (vehicle: TransitVehicle): RiskProfile => {
  const { unitsLate, daysLate, tolerance, status } = vehicle;

  if (status === 'DOWN') {
    return {
      score: Math.max(unitsLate, tolerance),
      level: RiskLevel.CRITICAL,
      label: 'Asset DOWN'
    };
  }

  if (unitsLate > tolerance || daysLate > 14) {
    return {
      score: Math.max(unitsLate, daysLate * 71),
      level: RiskLevel.CRITICAL,
      label: `${unitsLate}km, ${daysLate}d Overdue`
    };
  }

  if (unitsLate > (tolerance * 0.5) || daysLate > 7) {
    return {
      score: unitsLate,
      level: RiskLevel.WARNING,
      label: `Due Soon (${daysLate}d)`
    };
  }

  return { score: unitsLate, level: RiskLevel.STABLE, label: 'Optimal' };
};

const parseMaintenanceCsv = (csvText: string): MaintenanceCsvRow[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const startIndex = lines.length > 1 && isTypeRow(parseCsvLine(lines[1])) ? 2 : 1;
  const rows: MaintenanceCsvRow[] = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row: MaintenanceCsvRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
};

const toVehicle = (row: MaintenanceCsvRow): TransitVehicle => {
  return {
    alias: row.alias ?? '',
    assetDescription: row.assetdescription ?? '',
    unitsLate: toNumber(row.unitslate),
    daysLate: toNumber(row.dayslate),
    tolerance: toNumber(row.tolerance),
    nextTrigger: toNumber(row.nexttrigger),
    lastReading: toNumber(row.lastreading),
    location: normalizeLocation(row.locdescription ?? ''),
    status: normalizeStatus(row.assetstatus ?? row.pmstatus ?? '')
  };
};

const deriveDataGaps = (row: MaintenanceCsvRow, reportDate: Date | null): string[] => {
  const gaps: string[] = [];
  if (!row.alias) {
    gaps.push('missing alias');
  }
  if (!row.lastreading) {
    gaps.push('missing lastreading');
  }
  if (!row.nexttrigger) {
    gaps.push('missing nexttrigger');
  }
  if (!row.lastpmwogenread) {
    gaps.push('missing lastpmwogenread');
  }
  if (!reportDate) {
    gaps.push('invalid or missing reportdate');
  }
  return gaps;
};

const toRiskDetails = (
  row: MaintenanceCsvRow,
  previousRow: MaintenanceCsvRow | null,
  asOfDate: Date
): BusRiskDetails => {
  const vehicle = toVehicle(row);
  const risk = calculateVehicleRisk(vehicle);
  const reportDate = parseReportDate(row.reportdate);
  const yearBuilt = extractYear(vehicle.assetDescription);
  const ageYears = yearBuilt ? asOfDate.getFullYear() - yearBuilt : null;
  const conventional = isConventionalBus(row.assetdescription ?? '', row.metername ?? '');
  const previousUnitsLate = previousRow ? toNumber(previousRow.unitslate) : null;
  const previousDaysLate = previousRow ? toNumber(previousRow.dayslate) : null;
  const unitsLateDelta = previousUnitsLate === null ? null : vehicle.unitsLate - previousUnitsLate;
  const daysLateDelta = previousDaysLate === null ? null : vehicle.daysLate - previousDaysLate;
  const overToleranceByKm = Math.max(vehicle.unitsLate - vehicle.tolerance, 0);
  const riskRatio = vehicle.tolerance > 0 ? vehicle.unitsLate / vehicle.tolerance : 0;
  const freshness = freshnessFromDate(reportDate, asOfDate);
  const dataGaps = deriveDataGaps(row, reportDate);
  const riskFactors: string[] = [];

  if (vehicle.status === 'DOWN') {
    riskFactors.push('asset marked DOWN');
  }
  if (vehicle.unitsLate > vehicle.tolerance) {
    riskFactors.push(`over tolerance by ${overToleranceByKm}km`);
  }
  if (vehicle.daysLate > 7) {
    riskFactors.push(`${vehicle.daysLate} days overdue`);
  }
  if (freshness !== 'CURRENT') {
    riskFactors.push(`data freshness ${freshness.toLowerCase()}`);
  }
  if (!conventional) {
    riskFactors.push('non-conventional asset included');
  }

  return {
    busNumber: vehicle.alias,
    assetDescription: vehicle.assetDescription,
    assetType: conventional ? 'CONVENTIONAL_BUS' : 'NON_CONVENTIONAL_ASSET',
    isConventionalBus: conventional,
    location: vehicle.location,
    assetStatus: vehicle.status,
    reportDate,
    odometerKm: vehicle.lastReading,
    nextServiceKm: vehicle.nextTrigger,
    kmToNextService: toNumber(row.unitstogo),
    unitsLate: vehicle.unitsLate,
    daysOverdue: vehicle.daysLate,
    toleranceKm: vehicle.tolerance,
    riskLevel: risk.level,
    riskScore: risk.score,
    riskLabel: risk.label,
    riskRatio,
    overToleranceByKm,
    yearBuilt,
    ageYears,
    currentJobPlan: row.curjpdescription ?? '',
    nextJobPlan: row.jpdescription ?? '',
    unitsLateDelta,
    daysLateDelta,
    dataFreshness: freshness,
    dataGaps,
    riskFactors
  };
};

const latestByAlias = (rows: MaintenanceCsvRow[]): Map<string, MaintenanceCsvRow> => {
  const out = new Map<string, MaintenanceCsvRow>();
  for (const row of rows) {
    const alias = row.alias ?? '';
    if (!alias) {
      continue;
    }
    const existing = out.get(alias);
    if (!existing) {
      out.set(alias, row);
      continue;
    }

    const existingDate = parseReportDate(existing.reportdate);
    const rowDate = parseReportDate(row.reportdate);
    if (!existingDate || (rowDate && rowDate > existingDate)) {
      out.set(alias, row);
    }
  }
  return out;
};

const rankRisk = (risk: RiskLevel): number => {
  if (risk === RiskLevel.CRITICAL) {
    return 3;
  }
  if (risk === RiskLevel.WARNING) {
    return 2;
  }
  return 1;
};

const summarizeDepot = (assets: BusRiskDetails[], location: TransitVehicle['location']): DepotRiskSummary => {
  const scoped = assets.filter((asset) => asset.location === location);
  const totalDays = scoped.reduce((sum, asset) => sum + asset.daysOverdue, 0);
  const totalAssets = scoped.length;
  return {
    location,
    totalAssets,
    critical: scoped.filter((asset) => asset.riskLevel === RiskLevel.CRITICAL).length,
    warning: scoped.filter((asset) => asset.riskLevel === RiskLevel.WARNING).length,
    stable: scoped.filter((asset) => asset.riskLevel === RiskLevel.STABLE).length,
    avgDaysOverdue: totalAssets > 0 ? Number((totalDays / totalAssets).toFixed(2)) : 0
  };
};

const buildBusRiskReport = (
  currentSnapshotCsv: string,
  previousSnapshotCsv?: string,
  asOfDate: Date = new Date()
): BusRiskReport => {
  const currentRows = parseMaintenanceCsv(currentSnapshotCsv);
  const previousRows = previousSnapshotCsv ? parseMaintenanceCsv(previousSnapshotCsv) : [];
  const currentByAlias = latestByAlias(currentRows);
  const previousByAlias = latestByAlias(previousRows);

  const assets = Array.from(currentByAlias.values())
    .map((row) => toRiskDetails(row, previousByAlias.get(row.alias ?? '') ?? null, asOfDate))
    .sort((a, b) => {
      const riskDiff = rankRisk(b.riskLevel) - rankRisk(a.riskLevel);
      if (riskDiff !== 0) {
        return riskDiff;
      }
      if (b.unitsLate !== a.unitsLate) {
        return b.unitsLate - a.unitsLate;
      }
      return b.daysOverdue - a.daysOverdue;
    });

  const fleet: FleetRiskSummary = {
    totalAssets: assets.length,
    critical: assets.filter((asset) => asset.riskLevel === RiskLevel.CRITICAL).length,
    warning: assets.filter((asset) => asset.riskLevel === RiskLevel.WARNING).length,
    stable: assets.filter((asset) => asset.riskLevel === RiskLevel.STABLE).length,
    overduePercent:
      assets.length > 0
        ? Number((((assets.filter((asset) => asset.unitsLate > 0).length) / assets.length) * 100).toFixed(2))
        : 0
  };

  const depots: DepotRiskSummary[] = [
    summarizeDepot(assets, 'Raleigh'),
    summarizeDepot(assets, 'Westney'),
    summarizeDepot(assets, 'Unknown')
  ].filter((depot) => depot.totalAssets > 0);

  return { assets, fleet, depots };
};

export {
  MaintenanceCsvRow,
  TransitVehicle,
  RiskLevel,
  RiskProfile,
  BusRiskDetails,
  DepotRiskSummary,
  FleetRiskSummary,
  BusRiskReport,
  parseMaintenanceCsv,
  calculateVehicleRisk,
  buildBusRiskReport
};