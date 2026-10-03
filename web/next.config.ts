import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The parent folders contain unrelated lockfiles; pin the project root to this app.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
