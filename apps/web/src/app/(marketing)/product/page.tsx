import type { Metadata } from "next";
import { IndexPage } from "@/components/marketing/templates";
import { PRODUCT } from "@/content/marketing/product";
import { buildMetadata, softwareApplicationJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({ title: PRODUCT.metaTitle, description: PRODUCT.metaDescription, path: PRODUCT.path });

export default function ProductPage() {
  return <IndexPage page={PRODUCT} jsonLd={[softwareApplicationJsonLd({ description: PRODUCT.metaDescription, path: PRODUCT.path })]} />;
}
