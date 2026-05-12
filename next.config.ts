import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',      // Static HTML/JS/CSS → out/
  trailingSlash: true,   // /index.html compatibility
  images: {
    unoptimized: true,   // Required for static export
  },
};

export default nextConfig;
