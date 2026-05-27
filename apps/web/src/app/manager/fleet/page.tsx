import React from 'react';
import { UserRole } from '@transport/shared-types';
import { RoleGuard } from '../../../components/guards/RoleGuard';

export default function ManagerFleetPage(): React.ReactElement {
  return (
    <RoleGuard allowedRoles={[UserRole.MANAGER]}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header className="border-b border-zinc-800 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight">Fleet Administration</h1>
            <p className="text-zinc-400 text-sm mt-1">Configure vehicle assets and assignments.</p>
          </div>
          <a href="/manager/dashboard" className="text-zinc-400 hover:text-zinc-200 text-sm">
            Back to Hub
          </a>
        </header>
        <div className="bg-zinc-900 border border-zinc-800 rounded-card shadow overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/55 text-zinc-400 font-semibold">
                <th className="p-4">Bus ID</th>
                <th className="p-4">Model</th>
                <th className="p-4">Route Assignment</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              <tr>
                <td className="p-4 font-mono">BUS-001</td>
                <td className="p-4">TransitEV-X2</td>
                <td className="p-4 font-medium text-brand-primary">104 Express</td>
                <td className="p-4">
                  <span
                    className="bg-emerald-950 text-emerald-400 border border-emerald-900
                      px-2 py-0.5 rounded-full text-xs"
                  >
                    Active
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-4 font-mono">BUS-002</td>
                <td className="p-4">CityLiner-G3</td>
                <td className="p-4 font-medium text-brand-primary">Airport Shuttle</td>
                <td className="p-4">
                  <span
                    className="bg-amber-950 text-amber-400 border border-amber-900 px-2 py-0.5 rounded-full text-xs"
                  >
                    Maintenance
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </RoleGuard>
  );
}
