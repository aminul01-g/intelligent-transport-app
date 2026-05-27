import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function PassengerMapPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.PASSENGER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Interactive Map</h1>
            <p className="text-zinc-400 text-sm mt-1">Live tracking and route navigation map.</p>
          </div>
          <a href="/passenger/dashboard" className="text-zinc-400 hover:text-zinc-200 text-sm">
            Back to Dashboard
          </a>
        </header>
        <div
          className="bg-zinc-900 border border-zinc-800 rounded-card h-[500px] flex items-center
            justify-center relative overflow-hidden shadow"
        >
          <div
            className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)]
              [background-size:16px_16px] opacity-40"
          />
          <div className="text-center space-y-2 z-10">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary/10
                text-brand-primary border border-brand-primary/20"
            >
              GPS Signal Ready
            </span>
            <p className="text-zinc-500 font-mono text-xs">Live Map Render Area</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
