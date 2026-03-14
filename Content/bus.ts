


// The core vehicle def
interface TransitVehicle {
  alias: string;               // Bus Number (e.g., "8592")
  assetDescription: string;    // Year/Make/Model (e.g., "2014 New Flyer")
  unitsLate: number;           // KM past schedule
  daysLate: number;            // Time past schedule
  tolerance: number;           // Allowed buffer (usually 1000)
  nextTrigger: number;         // Odometer target
  lastReading: number;         // Current Odometer
  location: 'Raleigh' | 'Westney'; // Garage site
  status: 'ACTIVE' | 'OPERATING' | 'DOWN';
}

// The result of our risk calculation
enum RiskLevel {
  CRITICAL = 'CRITICAL', // Over tolerance
  WARNING = 'WARNING',   // Approaching tolerance
  STABLE = 'STABLE'      // Well within limits
}



