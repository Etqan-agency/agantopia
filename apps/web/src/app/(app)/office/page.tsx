import type { Metadata } from "next";
import { OfficePageClient } from "@/office/OfficePageClient";

export const metadata: Metadata = { title: "Office · Agentopia" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const flag = (v: string | string[] | undefined) => v === "1" || v === "true";

export default async function OfficePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return <OfficePageClient mock={flag(sp.mock)} hud={flag(sp.hud) || flag(sp.bench)} bench={flag(sp.bench)} listView={sp.view === "list"} />;
}
