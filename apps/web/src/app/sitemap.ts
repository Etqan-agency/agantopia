import type { MetadataRoute } from "next";
import { MARKETING_ROUTES } from "@/content/marketing/routes";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return MARKETING_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
