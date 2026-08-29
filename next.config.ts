import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@prisma/adapter-pg",
  ],
  async redirects() {
    return [
      { source: "/seo", destination: "/dashboard", permanent: false },
      { source: "/seo/:path*", destination: "/dashboard", permanent: false },
      { source: "/autopilot", destination: "/dashboard", permanent: false },
      { source: "/autopilot/:path*", destination: "/dashboard", permanent: false },
      { source: "/visibility", destination: "/sites", permanent: false },
      { source: "/visibility/:path*", destination: "/sites", permanent: false },
      { source: "/ai-search", destination: "/dashboard", permanent: false },
      { source: "/ai-search/:path*", destination: "/dashboard", permanent: false },
      { source: "/recommendations", destination: "/dashboard", permanent: false },
      { source: "/recommendations/:path*", destination: "/dashboard", permanent: false },
      { source: "/optimize", destination: "/ad-studio", permanent: false },
      { source: "/reports", destination: "/analytics", permanent: false },
      { source: "/reports/:path*", destination: "/analytics", permanent: false },
      { source: "/traffic", destination: "/analytics", permanent: false },
      { source: "/citations", destination: "/dashboard", permanent: false },
      { source: "/backlinks", destination: "/dashboard", permanent: false },
      { source: "/seo-autopilot", destination: "/", permanent: false },
      { source: "/ai-search-optimization", destination: "/", permanent: false },
      { source: "/free-seo-geo-audit", destination: "/", permanent: false },
      { source: "/guides", destination: "/", permanent: false },
      { source: "/guides/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
