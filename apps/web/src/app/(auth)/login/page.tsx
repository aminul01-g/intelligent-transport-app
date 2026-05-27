import React from 'react';

export default function LoginPage(): React.ReactElement {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 px-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-card shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div
            className="h-12 w-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center
              justify-center mx-auto border border-brand-primary/20"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0-8v6m0-6V9m0-2h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Sign In</h1>
          <p className="text-zinc-400 text-sm">Access the Intelligent Transport Platform</p>
        </div>
        <div className="border border-zinc-800 rounded-input p-4 text-center bg-zinc-950/50">
          <p className="text-zinc-500 text-xs font-mono">Authentication Module Stub</p>
        </div>
      </div>
    </div>
  );
}
