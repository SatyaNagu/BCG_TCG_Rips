import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` uses .next. Test builds (npm run build:check / start:check) use .next-check,
  // so building never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
