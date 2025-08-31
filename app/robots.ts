// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://www.detecto-ai.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // disallow: ["/api/"], // optional: API aussperren
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}