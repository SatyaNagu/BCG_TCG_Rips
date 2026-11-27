import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` uses .next. Test builds (npm run build:check / start:check) use .next-check,
  // so building never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No floating Next.js badge in the corner while developing.
  devIndicators: false,
};

export default nextConfig;
