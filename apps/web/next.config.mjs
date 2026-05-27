/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@transport/shared-types', '@transport/ui-kit'],
  typescript: {
    // Enable TypeScript strict type checking in Next.js build
    ignoreBuildErrors: false,
  },
  images: {
    // Configure domains for API/external media
    domains: ['localhost', '127.0.0.1'],
  },
  experimental: {
    serverComponentsExternalPackages: ['socket.io-client'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:4000',
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
};

export default nextConfig;
