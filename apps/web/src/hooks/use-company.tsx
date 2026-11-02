"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "./api-shapes";
import { useCompanyDetail, useMe } from "./use-api";

import { FLOOR_COOKIE } from "./floor-cookie";
export { FLOOR_COOKIE };

export type FloorOption = {
  id: string;
  name: string;
  order: number;
  buildingId: string;
  buildingName: string;
  companyId: string | null;
  companyName: string | null;
  isDemo: boolean;
};

type CompanyContextValue = {
  companyId: string | null;
  floorId: string | null;
  floors: FloorOption[];
  currentFloor: FloorOption | null;
  companyName: string | null;
  /** True when the selected company is the seeded demo (all activity simulated). */
  isDemo: boolean;
  setFloor: (floorId: string) => void;
  me: MeResponse | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

function flattenFloors(me: MeResponse | undefined): FloorOption[] {
  if (!me?.buildings) return [];
  const out: FloorOption[] = [];
  for (const b of me.buildings) {
    const floors = [...(b.floors ?? [])].sort((a, z) => a.order - z.order);
    for (const f of floors) {
      out.push({
        id: f.id,
        name: f.name,
        order: f.order,
        buildingId: b.id,
        buildingName: b.name,
        companyId: f.companyId ?? f.company?.id ?? null,
        companyName: f.company?.name ?? null,
        isDemo: Boolean(b.isDemo),
      });
    }
  }
  return out;
}

function writeFloorCookie(floorId: string) {
  // One year, whole site, Lax: only a UI preference, no secret.
  document.cookie = `${FLOOR_COOKIE}=${encodeURIComponent(floorId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function CompanyProvider({ initialFloorId, children }: { initialFloorId?: string | null; children: ReactNode }) {
  const me = useMe();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(initialFloorId ?? null);
  const floors = useMemo(() => flattenFloors(me.data), [me.data]);

  const currentFloor = useMemo(() => {
    if (!floors.length) return null;
    const bySelection = selected ? floors.find((f) => f.id === selected) : undefined;
    if (bySelection) return bySelection;
    const byDefault = me.data?.defaultCompanyId ? floors.find((f) => f.companyId === me.data?.defaultCompanyId) : undefined;
    return byDefault ?? floors.find((f) => f.companyId) ?? floors[0];
  }, [floors, selected, me.data?.defaultCompanyId]);

  const companyId = currentFloor?.companyId ?? null;
  const detail = useCompanyDetail(companyId);

  const setFloor = useCallback(
    (floorId: string) => {
      setSelected(floorId);
      writeFloorCookie(floorId);
      // Company-scoped data for the old floor is no longer on screen; let it refetch lazily.
      void qc.invalidateQueries({ queryKey: ["company"], refetchType: "none" });
    },
    [qc],
  );

  const value: CompanyContextValue = {
    companyId,
    floorId: currentFloor?.id ?? null,
    floors,
    currentFloor,
    companyName: detail.data?.name ?? currentFloor?.companyName ?? null,
    isDemo: detail.data?.isDemo ?? currentFloor?.isDemo ?? false,
    setFloor,
    me: me.data,
    isLoading: me.isLoading,
    error: me.error,
    refetch: () => void me.refetch(),
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany() must be used inside <CompanyProvider> (the (app) layout).");
  return ctx;
}

/** Same as useCompany() but returns null outside the provider (for shared components). */
export function useOptionalCompany(): CompanyContextValue | null {
  return useContext(CompanyContext);
}
