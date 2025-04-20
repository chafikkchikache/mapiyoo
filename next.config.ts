import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 👇 Add this
  experimental: {
    serverActions: true,
    allowedDevOrigins: [
      'https://9003-idx-studio-1745089594276.cluster-6vyo4gb53jczovun3dxslzjahs.cloudworkstations.dev',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
