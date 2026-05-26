import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Intelligent Transport Ecosystem',
  description: 'Enterprise fleet monitoring and telemetry platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: 'radial-gradient(ellipse at top, #18181b, #09090b)',
          color: '#f4f4f5',
          minHeight: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
