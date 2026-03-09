import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["47.85.28.209"],
  // instrumentation.ts is enabled by default in Next.js 15+, no experimental flag needed
};

export default nextConfig;
