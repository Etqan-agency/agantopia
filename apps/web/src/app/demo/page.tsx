import { DemoPageClient } from "@/office/DemoPageClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const flag = (v: string | string[] | undefined) => v === "1" || v === "true";

export default async function DemoPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return <DemoPageClient mock={flag(sp.mock)} hud={flag(sp.hud) || flag(sp.bench)} bench={flag(sp.bench)} listView={sp.view === "list"} />;
}
