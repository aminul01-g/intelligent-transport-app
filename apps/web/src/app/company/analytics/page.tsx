import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function CompanyAnalyticsPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.COMPANY_LEAD]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Enterprise Analytics</h1>
            <p className="text-zinc-400 text-sm mt-1">Strategic intelligence reports and resource auditing charts.</p>
          </div>
          <a href="/company/dashboard" className="text-zinc-400 hover:text-zinc-200 text-sm">
            Back to Console
          </a>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow text-center">
            <span className="text-zinc-550 text-xs font-semibold block mb-1">Monthly Rides</span>
            <span className="text-3xl font-extrabold font-mono text-brand-primary">1.24M</span>
            <span className="text-emerald-500 text-xs block mt-1">↑ +8.2% vs last month</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow text-center">
            <span className="text-zinc-550 text-xs font-semibold block mb-1">Gross Revenue</span>
            <span className="text-3xl font-extrabold font-mono text-brand-secondary">$3.42M</span>
            <span className="text-emerald-500 text-xs block mt-1">↑ +12.4% vs last month</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-card shadow text-center">
            <span className="text-zinc-550 text-xs font-semibold block mb-1">EV Fleet Ratio</span>
            <span className="text-3xl font-extrabold font-mono text-zinc-200">76.2%</span>
            <span className="text-zinc-500 text-xs block mt-1">Target: 100% by 2028</span>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
