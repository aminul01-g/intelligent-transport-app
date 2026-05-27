import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function PassengerHistoryPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.PASSENGER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Ride History</h1>
            <p className="text-zinc-400 text-sm mt-1">Review your past travels and transactions.</p>
          </div>
          <a href="/passenger/dashboard" className="text-zinc-400 hover:text-zinc-200 text-sm">
            Back to Dashboard
          </a>
        </header>
        <div className="bg-zinc-900 border border-zinc-800 rounded-card divide-y divide-zinc-800 shadow">
          <div className="p-4 flex justify-between items-center text-sm">
            <div>
              <p className="font-semibold text-zinc-200">Route 14A Express (City Center → Airport)</p>
              <p className="text-zinc-500 text-xs">May 26, 2026 • 14:32</p>
            </div>
            <span className="font-mono text-zinc-300 font-medium">-$2.75</span>
          </div>
          <div className="p-4 flex justify-between items-center text-sm">
            <div>
              <p className="font-semibold text-zinc-200">Route 8 Westbound (Metro Station → Mall)</p>
              <p className="text-zinc-500 text-xs">May 24, 2026 • 08:15</p>
            </div>
            <span className="font-mono text-zinc-300 font-medium">-$1.50</span>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
