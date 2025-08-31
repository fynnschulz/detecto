// app/sitemap.ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.detecto-ai.com";
  const now = new Date().toISOString();

  const pages = [
    { url: "/", priority: 1.0 },
    { url: "/WebsiteScan", priority: 0.9 },
    { url: "/search", priority: 0.85 },
    { url: "/community", priority: 0.8 },
    { url: "/leak-check", priority: 0.9 },
    { url: "/vpn", priority: 0.6 },
    { url: "/news", priority: 0.5 }, // falls vorhanden
    // Additional routes
    { url: "/impressum", priority: 0.7 },
    { url: "/nutzung", priority: 0.7 },
    { url: "/rechtliches", priority: 0.7 },
    { url: "/register", priority: 0.6 },
    { url: "/einstellungen", priority: 0.6 },
    { url: "/ueber-uns", priority: 0.7 },
    { url: "/cookies", priority: 0.6 },
  ];

  return pages.map(p => ({
    url: base + p.url,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p.priority,
  }));
}