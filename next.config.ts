import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@prisma/adapter-pg",
    "@temporalio/client",
  ],
};

export default nextConfig;
