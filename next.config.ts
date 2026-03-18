import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeping config minimal; dev uses webpack (see package.json) to avoid Turbopack filesystem timeouts.
};

export default nextConfig;
