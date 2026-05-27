import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function PassengerDashboardPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.PASSENGER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Passenger Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Real-time status, schedules, and profile management.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow">
            <h2 className="text-lg font-semibold mb-2">Transit Services</h2>
            <p className="text-zinc-400 text-sm">
              View ongoing bus coordinates, expected arrival, and smart transit tracking.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow">
            <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <a href="/passenger/map" className="text-brand-primary hover:underline text-sm font-medium">
                Interactive Map →
              </a>
              <a href="/passenger/wallet" className="text-brand-primary hover:underline text-sm font-medium">
                Digital Wallet →
              </a>
              <a href="/passenger/history" className="text-brand-primary hover:underline text-sm font-medium">
                Ride History →
              </a>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
