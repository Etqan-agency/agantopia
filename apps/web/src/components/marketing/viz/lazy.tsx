"use client";

import dynamic from "next/dynamic";

/**
 * Code-split versions of the interactive viz components for `VisualSlot`.
 *
 * `VisualSlot` (and every template that imports it) is a Server Component that can render any
 * viz, so importing the client components directly puts all of them, plus `motion`, into the
 * client bundle of every marketing page, including pages that render none of them. Wrapping them
 * with `next/dynamic` inside a Client Component splits each into its own chunk that loads only
 * when that viz is rendered. SSR stays on, so the server HTML and first paint are unchanged.
 * (next/dynamic does not code-split when called from a Server Component, hence this file.)
 */
export const LazyAgentRoleSelector = dynamic(() => import("./agent-role-selector").then((m) => m.AgentRoleSelector));
export const LazyFeatureShowcaseTabs = dynamic(() => import("./feature-showcase-tabs").then((m) => m.FeatureShowcaseTabs));
export const LazyMultiFloorBuildingPreview = dynamic(() =>
  import("./multi-floor-building-preview").then((m) => m.MultiFloorBuildingPreview),
);
