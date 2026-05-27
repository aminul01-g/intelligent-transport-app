import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function DriverDashboardPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.DRIVER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Driver Portal</h1>
          <p className="text-zinc-400 text-sm mt-1">Shift duties, vehicle telemetry, and route tracking.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow space-y-4">
            <h2 className="text-lg font-semibold">Active Shift</h2>
            <div className="border border-zinc-800 rounded-input p-4 bg-zinc-950/30 text-sm space-y-2">
              <p className="text-zinc-400">
                <strong className="text-zinc-200">Route:</strong> Route 104 Express
              </p>
              <p className="text-zinc-400">
                <strong className="text-zinc-200">Bus ID:</strong> BUS-9843
              </p>
              <p className="text-zinc-400">
                <strong className="text-zinc-200">Status:</strong> On Duty
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href="/driver/navigation"
                className="bg-brand-primary hover:bg-blue-700 text-white font-medium py-2 px-4
                  rounded-input text-sm text-center flex-1"
              >
                Launch Navigation
              </a>
              <a
                href="/driver/check-in"
                className="border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium py-2 px-4
                  rounded-input text-sm text-center flex-1"
              >
                Boarding Check-In
              </a>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow">
            <h2 className="text-lg font-semibold mb-2">Driver Stats</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="border border-zinc-800 p-4 rounded-input bg-zinc-950/50">
                <span className="text-zinc-500 text-xs block">Rating</span>
                <span className="text-xl font-bold font-mono text-brand-secondary">4.92 ★</span>
              </div>
              <div className="border border-zinc-800 p-4 rounded-input bg-zinc-950/50">
                <span className="text-zinc-500 text-xs block">Hours</span>
                <span className="text-xl font-bold font-mono text-zinc-200">38.5h</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
