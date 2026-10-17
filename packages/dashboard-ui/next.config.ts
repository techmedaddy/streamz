import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      {
        source: '/api/orders/:path*',
        destination: 'http://localhost:3001/orders/:path*',
      },
      {
        source: '/api/orders',
        destination: 'http://localhost:3001/orders',
      },
      {
        source: '/api/products/:path*',
        destination: 'http://localhost:3002/products/:path*',
      },
      {
        source: '/api/products',
        destination: 'http://localhost:3002/products',
      },
    ];
  },
};

export default nextConfig;
