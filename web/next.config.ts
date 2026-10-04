import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The parent folders contain unrelated lockfiles; pin the project root to this app.
  turbopack: { root: path.join(__dirname) },
  // Ask moved to the home page. Old links to /ask (and /ask?q=...) keep working.
  async redirects() {
    return [{ source: "/ask", destination: "/", permanent: false }];
  },
  // The service worker must never be cached by the browser or a CDN, so a new version is picked up on the next visit.
  async headers() {
    return [
      { source: "/sw.js", headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Service-Worker-Allowed", value: "/" },
      ] },
    ];
  },
};

export default nextConfig;
