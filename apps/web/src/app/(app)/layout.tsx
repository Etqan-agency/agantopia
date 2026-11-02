import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { FLOOR_COOKIE } from "@/hooks/floor-cookie";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const raw = store.get(FLOOR_COOKIE)?.value;
  return <AppShell initialFloorId={raw ? decodeURIComponent(raw) : null}>{children}</AppShell>;
}
