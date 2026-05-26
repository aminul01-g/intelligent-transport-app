/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Automatically transpile monorepo packages
  transpilePackages: ['@transport/shared-types', '@transport/ui-kit'],
};

export default nextConfig;
