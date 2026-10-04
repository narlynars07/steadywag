import type { MetadataRoute } from "next";

/** The web app manifest: what the home-screen icon, name and window look like when Steadywag is installed. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Steadywag: Theo's care companion",
    short_name: "Steadywag",
    description: "A care companion for one dog. It reads his records and tells you what the paperwork doesn't say.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4f9",
    theme_color: "#8a4de8",
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", short_name: "Today", url: "/today", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Daily check-in", short_name: "Check-in", url: "/check-in", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Appointments", short_name: "Appointments", url: "/appointments", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
