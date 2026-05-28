import { UserRole, PassengerCategory, DocumentStatus } from './enums';

// ── New shared contracts ──
export * from './enums';
export * from './api.types';
export * from './live-bus.types';

// ──────────────────────────────────────────────
// Auth entity types (mirror DB schema exactly)
// ──────────────────────────────────────────────

/**
 * Full user record as stored in the database.
 * NEVER send this type over the wire — use UserPublic instead.
 */
export interface User {
  id: string;
  email: string;
  phone: string;
  /** Bcrypt hash — must NEVER appear in any API response. */
  password_hash: string;
  role: UserRole;
  passenger_category: PassengerCategory;
  full_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Safe user shape for all API responses.
 * password_hash is stripped at the type level — the compiler enforces this.
 */
export type UserPublic = Omit<User, 'password_hash'>;

/** Mirrors the user_documents table. */
export interface UserDocument {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  verified_by: string | null;
  verified_at: string | null;
  status: DocumentStatus;
  created_at: string;
}

/**
 * Mirrors the wallets table.
 * balance / held_balance arrive as strings from the pg driver
 * because PostgreSQL NUMERIC does not map to a JS number without precision loss.
 */
export interface Wallet {
  id: string;
  user_id: string;
  balance: string;
  held_balance: string;
  currency: string;
  updated_at: string;
}

/** Mirrors the refresh_tokens table. */
export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  device_info: Record<string, unknown> | null;
  created_at: string;
}

// ── Legacy types (Prompt 1.1) ──
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
