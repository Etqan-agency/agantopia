import type { MetadataRoute } from "next";
import { DISALLOWED_PREFIXES } from "@/content/marketing/routes";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_PREFIXES],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
