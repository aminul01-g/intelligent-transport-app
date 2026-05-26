export type VehicleType = 'BUS' | 'TRAIN' | 'TRAM' | 'METRO' | 'EV_SHUTTLE';

export type VehicleStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'MAINTENANCE'
  | 'OUT_OF_SERVICE';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TelemetryData {
  vehicleId: string;
  timestamp: string;
  speedKmh: number;
  location: Coordinates;
  headingDegrees: number;
  fuelLevelPercentage: number;
  batteryHealthPercentage?: number; // Optional for non-EVs
  passengerCount: number;
  engineTemperatureCelsius: number;
}

export interface Vehicle {
  id: string;
  vin: string;
  type: VehicleType;
  model: string;
  capacity: number;
  status: VehicleStatus;
  lastUpdated: string;
}

export interface Route {
  id: string;
  routeName: string;
  routeCode: string;
  waypoints: Coordinates[];
  stopNames: string[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
}

export interface Alert {
  id: string;
  vehicleId?: string;
  routeId?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: string;
  resolved: boolean;
}
