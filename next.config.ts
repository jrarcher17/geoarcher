import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@prisma/adapter-pg",
  ],
};

export default nextConfig;
