import React from 'react';

export default function RegisterPage(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-card shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div
            className="h-12 w-12 bg-brand-secondary/10 text-brand-secondary rounded-xl flex items-center
              justify-center mx-auto border border-brand-secondary/20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Create Account</h1>
          <p className="text-zinc-400 text-sm">Join the Intelligent Transport Ecosystem</p>
        </div>
        <div className="border border-zinc-800 rounded-input p-4 text-center bg-zinc-950/50">
          <p className="text-zinc-500 text-xs font-mono">Registration Module Stub</p>
        </div>
      </div>
    </div>
  );
}
