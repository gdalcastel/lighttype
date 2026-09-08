import type { NextConfig } from "next";

const API = process.env.API_URL ?? "http://127.0.0.1:8765";
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  // Web/Docker: standalone. Mobile (Capacitor): static export → app/out
  output: isCapacitorBuild ? "export" : "standalone",
  ...(isCapacitorBuild
    ? {
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${API}/api/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
