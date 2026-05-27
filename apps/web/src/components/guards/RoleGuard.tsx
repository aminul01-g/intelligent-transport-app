'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@transport/shared-types';
import { useAuthStore } from '../../store/auth.store';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({
  allowedRoles,
  children,
}: RoleGuardProps): React.ReactElement | null {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // If not loading, not authenticated, redirect to /login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-50">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"
          />
          <p className="text-zinc-400">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // If authenticated but role not allowed, show inline 403 error page (preserved URL)
  if (user && !allowedRoles.includes(user.role)) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-50 px-4"
      >
        <div
          className="max-w-md w-full text-center space-y-6 bg-zinc-900 border border-zinc-800
            p-8 rounded-card shadow-xl"
        >
          <div
            className="w-16 h-16 bg-red-950 border border-red-500 rounded-full flex items-center
              justify-center mx-auto text-brand-danger"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0-8v6m0-6V9m0-2h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">403 - Access Denied</h1>
            <p className="text-zinc-400 text-sm">
              Your account role{' '}
              <span className="font-mono text-brand-primary">
                {user.role}
              </span>{' '}
              does not have authorization to view this resource.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-brand-primary hover:bg-blue-700 text-white font-medium
                py-2 px-4 rounded-input transition duration-200"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
