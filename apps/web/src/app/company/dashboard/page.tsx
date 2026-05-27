import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function CompanyDashboardPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.COMPANY_LEAD]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Enterprise Console</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Company performance oversight, financial status, and configurations.
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow">
            <h2 className="text-lg font-semibold mb-2">Company Analytics</h2>
            <p className="text-zinc-400 text-sm mb-4">
              View total passenger metrics, carbon reductions, and financial revenues.
            </p>
            <a href="/company/analytics" className="text-brand-primary hover:underline text-sm font-medium">
              View Analytical Reports →
            </a>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow">
            <h2 className="text-lg font-semibold mb-2">System Health</h2>
            <div className="grid grid-cols-2 gap-4 text-center mt-2">
              <div className="border border-zinc-850 p-4 rounded-input bg-zinc-950/50">
                <span className="text-zinc-500 text-xs block">Ecosystem Health</span>
                <span className="text-2xl font-bold font-mono text-brand-secondary">99.9%</span>
              </div>
              <div className="border border-zinc-850 p-4 rounded-input bg-zinc-950/50">
                <span className="text-zinc-500 text-xs block">Operational Cost</span>
                <span className="text-2xl font-bold font-mono text-zinc-200">-12.4%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
