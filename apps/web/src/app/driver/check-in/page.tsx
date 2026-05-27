import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function DriverCheckInPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.DRIVER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Boarding Check-In</h1>
            <p className="text-zinc-400 text-sm mt-1">Scan passenger tickets or check in manually.</p>
          </div>
          <a href="/driver/dashboard" className="text-zinc-400 hover:text-zinc-200 text-sm">
            Back to Dashboard
          </a>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow space-y-4">
            <h2 className="text-lg font-semibold">Active Boarding Check-In</h2>
            <div
              className="bg-zinc-950 border border-zinc-850 p-8 rounded-xl flex flex-col
                items-center justify-center border-dashed text-center space-y-3"
            >
              <div
                className="h-12 w-12 rounded-full bg-brand-primary/10 flex items-center
                  justify-center text-brand-primary border border-brand-primary/20 animate-pulse"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-4V8m0 4h4m4 0h-4"
                  />
                </svg>
              </div>
              <p className="text-zinc-300 font-medium">Ready to Scan NFC/QR</p>
              <p className="text-zinc-500 text-xs max-w-[200px]">
                Hold ticket card near the scanner or scan QR code with passenger camera.
              </p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow space-y-4">
            <h2 className="text-lg font-semibold">Manual Roster</h2>
            <p className="text-zinc-400 text-sm">Enter ticket ID manually to override automatic boarding checks.</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ticket ID / Ticket Reference"
                className="flex-1 bg-zinc-950 border border-zinc-850 rounded-input px-3 py-2
                  text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-brand-primary"
              />
              <button className="bg-brand-primary hover:bg-blue-700 text-white font-medium px-4 rounded-input text-sm">
                Board
              </button>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
