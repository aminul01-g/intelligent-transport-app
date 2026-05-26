// ──────────────────────────────────────────────
// User & Access
// ──────────────────────────────────────────────

export enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  MANAGER = 'MANAGER',
  COMPANY_LEAD = 'COMPANY_LEAD',
}

export enum PassengerCategory {
  REGULAR = 'REGULAR',
  STUDENT = 'STUDENT',
  WORKER = 'WORKER',
  GOVT_PERSONNEL = 'GOVT_PERSONNEL',
}

// ──────────────────────────────────────────────
// Fleet
// ──────────────────────────────────────────────

export enum BusStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BREAKDOWN = 'BREAKDOWN',
  MAINTENANCE = 'MAINTENANCE',
}

// ──────────────────────────────────────────────
// Incidents
// ──────────────────────────────────────────────

export enum IncidentType {
  ACCIDENT = 'ACCIDENT',
  BREAKDOWN = 'BREAKDOWN',
  DELAY = 'DELAY',
  SECURITY = 'SECURITY',
  OTHER = 'OTHER',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatus {
  REPORTED = 'REPORTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}
