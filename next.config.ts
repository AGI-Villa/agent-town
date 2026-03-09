import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["47.85.28.209"],
  // Enable instrumentation.ts for server startup hooks
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
