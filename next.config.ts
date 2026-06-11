import type { NextConfig } from "next";

// All browser API calls go to /backend-api/* on THIS domain and are proxied
// server-side to the NestJS backend. This keeps the httpOnly auth cookie
// first-party (works in Safari) and never exposes the JWT to JavaScript.
const BACKEND_API_ORIGIN =
  process.env.BACKEND_API_ORIGIN || "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${BACKEND_API_ORIGIN}/api/:path*`,
      },
      {
        // Static files served by the backend (e.g. product images under /uploads)
        source: "/backend-static/:path*",
        destination: `${BACKEND_API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
