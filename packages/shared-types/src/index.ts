import { UserRole, PassengerCategory, DocumentStatus, TripStatus, TransactionType } from './enums';

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

// ──────────────────────────────────────────────
// Ticketing, Fares & Operations Types
// ──────────────────────────────────────────────

/** Mirrors the route_stops table. */
export interface RouteStop {
  id: string;
  route_id: string;
  stop_name: string;
  latitude: string;
  longitude: string;
  sequence_order: number;
  distance_from_previous_km: string;
  estimated_travel_time_seconds: number;
}

/** Mirrors the routes table. */
export interface RouteRecord {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  base_price_per_km: string;
  created_at: string;
}

/** Mirrors the fare_rules table. */
export interface FareRule {
  id: string;
  route_id: string;
  passenger_category: PassengerCategory;
  discount_percentage: string;
  fixed_price: string | null;
  peak_hour_surcharge_pct: string;
  peak_start_hour: number | null;
  peak_end_hour: number | null;
  is_active: boolean;
  created_at: string;
}

/** Mirrors the trips table. */
export interface Trip {
  id: string;
  passenger_id: string;
  shift_id: string;
  boarding_stop_id: string;
  alighting_stop_id: string | null;
  estimated_max_fare: string;
  fare_charged: string | null;
  status: TripStatus;
  boarded_at: string;
  alighted_at: string | null;
  created_at: string;
}

/** Mirrors the transactions table. */
export interface Transaction {
  id: string;
  wallet_id: string;
  trip_id: string | null;
  amount: string;
  type: TransactionType;
  description: string | null;
  created_at: string;
}

/** Mirrors the shifts table. */
export interface Shift {
  id: string;
  driver_id: string;
  bus_id: string;
  route_id: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  created_at: string;
}
