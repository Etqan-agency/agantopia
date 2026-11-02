import type { Metadata } from "next";
import { createElement } from "react";

/**
 * Site configuration and SEO helpers for the marketing site.
 *
 * `buildMetadata()` returns absolute URLs (canonical, Open Graph, Twitter) so
 * pages do not depend on `metadataBase` being set in the root layout. Titles
 * are emitted as `{ absolute }` so the `metaTitle` written in
 * `src/content/marketing` is exactly what search engines see (the root
 * layout's "%s · Agentopia" template would otherwise push titles past 60
 * characters).
 */

export const SITE_NAME = "Agentopia";

/** Base URL without a trailing slash. Set APP_URL in production. */
export const SITE_URL = (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

export const DEFAULT_TITLE = "Agentopia: build your own AI company";

export const DEFAULT_DESCRIPTION =
  "Hire AI employees, give them an office and hand the manager a task. Agentopia runs the work through your own Claude Code or Codex sign-in, then you review it.";

/** Served from src/app/opengraph-image.png (1200×630). */
export const DEFAULT_OG_IMAGE = "/opengraph-image.png";
export const DEFAULT_OG_IMAGE_ALT = "Agentopia: a top-down office where AI employees work on tasks";

export const LOGO_PATH = "/brand/agentopia-logo-on-white.png";

/** Turns a site-relative path into an absolute URL on SITE_URL. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `${SITE_URL}/` : `${SITE_URL}${clean}`;
}

export type BuildMetadataInput = {
  /** Full page title, used as-is (no template suffix). Keep it at or under 60 characters. */
  title: string;
  /** Meta description. Keep it at or under 155 characters. */
  description: string;
  /** Site-relative canonical path, e.g. "/features/ai-manager". */
  path: string;
  /** Exclude the page from search results (still followed). */
  noIndex?: boolean;
  /** Optional page-specific social image (site-relative or absolute). */
  image?: { url: string; alt: string; width?: number; height?: number };
};

export function buildMetadata({ title, description, path, noIndex = false, image }: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const og = image ?? { url: DEFAULT_OG_IMAGE, alt: DEFAULT_OG_IMAGE_ALT, width: 1200, height: 630 };
  const ogImage = { url: absoluteUrl(og.url), alt: og.alt, width: og.width, height: og.height };
  return {
    metadataBase: new URL(SITE_URL),
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: "en_US",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImage.url, alt: ogImage.alt }],
    },
    robots: noIndex
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

/* ---------------------------------------------------------------------------
 * JSON-LD helpers. They return plain objects; render them with <JsonLd />.
 * Deliberately no offers, prices, ratings or reviews: none exist.
 * ------------------------------------------------------------------------- */

export type JsonLdObject = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl(LOGO_PATH),
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: DEFAULT_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

export function softwareApplicationJsonLd(input?: { description?: string; path?: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: absoluteUrl(input?.path ?? "/"),
    description: input?.description ?? DEFAULT_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    publisher: { "@id": ORG_ID },
  };
}

export type BreadcrumbItem = { name: string; path: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export type FaqJsonLdItem = { question: string; answer: string };

export function faqJsonLd(items: FaqJsonLdItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** JSON.stringify with `<` escaped so the payload cannot close the script tag. */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Server component: renders one JSON-LD script tag. */
export function JsonLd({ data, id }: { data: JsonLdObject | JsonLdObject[]; id?: string }) {
  return createElement("script", {
    type: "application/ld+json",
    id,
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  });
}
