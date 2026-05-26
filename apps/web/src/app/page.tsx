'use client';

import React, { useState } from 'react';
import { Vehicle, Alert } from '@transport/shared-types';
import { Button, Card, StatusBadge } from '@transport/ui-kit';

export default function DashboardPage(): React.ReactElement {
  const [vehicles] = useState<Vehicle[]>([
    {
      id: 'v-001',
      vin: '1HM1234567890ABCD',
      type: 'EV_SHUTTLE',
      model: 'TransitEV-X2',
      capacity: 24,
      status: 'ACTIVE',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'v-002',
      vin: '1HM9876543210EFGH',
      type: 'BUS',
      model: 'CityLiner-G3',
      capacity: 85,
      status: 'MAINTENANCE',
      lastUpdated: new Date().toISOString(),
    },
  ]);

  const [alerts] = useState<Alert[]>([
    {
      id: 'a-101',
      vehicleId: 'v-002',
      severity: 'WARNING',
      message:
        'Engine temperature approaching limit (102°C). Maintenance recommended.',
      timestamp: new Date().toISOString(),
      resolved: false,
    },
  ]);

  return (
    <main
      style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}
    >
      {/* Header */}
      <header style={{ marginBottom: '2.5rem' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 700,
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.025em',
          }}
        >
          Intelligent Transport Dashboard
        </h1>
        <p style={{ color: '#a1a1aa', margin: 0 }}>
          Real-time fleet monitoring, route mapping, and system telemetry.
        </p>
      </header>

      {/* Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Vehicles Section */}
        <Card glassmorphic>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
              Active Fleet
            </h2>
            <Button size="sm" variant="ghost">
              View All
            </Button>
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#18181b',
                  borderRadius: '0.5rem',
                  border: '1px solid #27272a',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {vehicle.model}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a' }}>
                    ID: {vehicle.id}
                  </div>
                </div>
                <StatusBadge status={vehicle.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Alerts Section */}
        <Card glassmorphic>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
              System Alerts
            </h2>
            <Button size="sm" variant="secondary">
              Acknowledge All
            </Button>
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '1rem',
                  backgroundColor:
                    alert.severity === 'CRITICAL'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '0.5rem',
                  border: `1px solid ${
                    alert.severity === 'CRITICAL'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(245, 158, 11, 0.2)'
                  }`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color:
                        alert.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#71717a' }}>
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    color: '#e4e4e7',
                    lineHeight: 1.4,
                  }}
                >
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
