import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No 'output: export' — Vercel hosts Next.js natively via .next/
  // For self-hosted static export, add: output: 'export'
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
