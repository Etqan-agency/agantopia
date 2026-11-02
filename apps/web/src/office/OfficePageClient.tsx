"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FloorView } from "@agentopia/shared";
import { useOptionalCompany } from "@/hooks/use-company";
import { fetchFloorView, fetchMyFloors } from "./data";
import type { FloorSummary } from "./FloorSwitcher";
import { buildMockFloorView, buildMockScript, MOCK_FLOORS } from "./mock";
import { OfficeExperience, type OfficeSource } from "./OfficeExperience";

const LIVE: OfficeSource = { kind: "live" };

/** /office: the live office of the current floor. */
export function OfficePageClient({ mock, hud, bench, listView = false }: { mock: boolean; hud: boolean; bench: boolean; listView?: boolean }) {
  const company = useOptionalCompany();
  const [localFloors, setLocalFloors] = useState<FloorSummary[]>(() => (mock ? MOCK_FLOORS : []));
  const [localFloorId, setLocalFloorId] = useState<string | null>(() => (mock ? MOCK_FLOORS[0]!.id : null));
  const [error, setError] = useState<string | null>(null);

  // Fallback when the app shell's CompanyProvider is not present: read /api/me ourselves.
  useEffect(() => {
    if (mock || company) return;
    let alive = true;
    fetchMyFloors()
      .then(({ floors, defaultCompanyId }) => {
        if (!alive) return;
        setLocalFloors(floors);
        setLocalFloorId((floors.find((f) => f.companyId === defaultCompanyId) ?? floors[0])?.id ?? null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Could not load your floors."));
    return () => {
      alive = false;
    };
  }, [company, mock]);

  const useShell = Boolean(company) && !mock;
  const floors: FloorSummary[] = useMemo(
    () =>
      useShell
        ? company!.floors.map((f) => ({ id: f.id, name: f.name, order: f.order, companyId: f.companyId, companyName: f.companyName }))
        : localFloors,
    [useShell, company, localFloors],
  );
  const floorId = useShell ? company!.floorId : localFloorId;
  const setFloor = useShell ? company!.setFloor : setLocalFloorId;

  const loadView = useCallback(
    async (id: string, signal: AbortSignal): Promise<FloorView> => (mock ? buildMockFloorView(id) : fetchFloorView(id, { signal })),
    [mock],
  );
  const source: OfficeSource = useMemo(
    () => (mock ? { kind: "demo", loadScript: async (v: FloorView) => (v.id === "mock-floor-2" ? [] : buildMockScript()) } : LIVE),
    [mock],
  );

  if (error) {
    return (
      <p role="alert" className="m-4 rounded-md bg-brick-wash p-4 text-sm text-brick-ink">
        {error}
      </p>
    );
  }
  return (
    <OfficeExperience
      floors={floors}
      floorId={floorId}
      onFloorChange={setFloor}
      loadView={loadView}
      source={source}
      hud={hud}
      bench={bench}
      listView={listView}
      notice={mock ? "Mock mode: a locally generated floor with simulated activity. Nothing here comes from the server." : null}
    />
  );
}
