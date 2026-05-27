'use client';

import React from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export function ToastContainer(): React.ReactElement {
  return (
    <div
      id="toast-container"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {/* Toast rendering portal or list stub */}
    </div>
  );
}
