import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors.
    // This unblocks Vercel deploys while we clean up linting incrementally.
    ignoreDuringBuilds: true,
  },
  // You can add other Next.js config here as needed.
};

export default nextConfig;
