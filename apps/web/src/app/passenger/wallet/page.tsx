import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function PassengerWalletPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.PASSENGER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Digital Wallet</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage transit passes and payment credentials.</p>
          </div>
          <a href="/passenger/dashboard" className="text-zinc-400 hover:text-zinc-200 text-sm">
            Back to Dashboard
          </a>
        </header>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card max-w-sm space-y-4 shadow-xl">
          <div className="bg-gradient-to-tr from-brand-primary to-blue-500 p-6 rounded-xl text-white space-y-8">
            <div className="flex justify-between items-start">
              <span className="font-bold text-sm tracking-wide">TransitCard</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Regular</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-white/70 block">Available Balance</span>
              <span className="text-2xl font-mono font-bold">$34.50</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 bg-brand-primary hover:bg-blue-700 text-white font-medium py-2 rounded-input text-sm"
            >
              Top Up
            </button>
            <button
              className="flex-1 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-medium
                py-2 rounded-input text-sm"
            >
              Passes
            </button>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
