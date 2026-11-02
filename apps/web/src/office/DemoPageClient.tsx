"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FloorView } from "@agentopia/shared";
import { fetchDemoBuilding, fetchDemoScript, fetchFloorView } from "./data";
import { normalizeScript } from "./demo-player";
import type { FloorSummary } from "./FloorSwitcher";
import { buildMockFloorView, buildMockScript, MOCK_FLOORS } from "./mock";
import { OfficeExperience, type OfficeSource } from "./OfficeExperience";

/**
 * /demo: the visitor building. Floors and views come from the public demo API;
 * the script is fetched once and replayed locally in the browser on a loop.
 * With `?mock=1` (or when the demo API is unavailable) a local mock is used.
 */
export function DemoPageClient({ mock: forceMock, hud, bench, listView = false }: { mock: boolean; hud: boolean; bench: boolean; listView?: boolean }) {
  const [mock, setMock] = useState(forceMock);
  const [apiFloors, setApiFloors] = useState<FloorSummary[]>([]);
  const [apiName, setApiName] = useState("Demo building");
  const [selectedFloorId, setFloorId] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const floors = mock ? MOCK_FLOORS : apiFloors;
  const buildingName = mock ? "Mock building" : apiName;
  const floorId = selectedFloorId && floors.some((f) => f.id === selectedFloorId) ? selectedFloorId : (floors[0]?.id ?? null);
  const notice = fallbackNotice ?? (forceMock ? "Mock mode: a locally generated floor. Nothing here comes from the server." : null);

  useEffect(() => {
    if (mock) return;
    let alive = true;
    fetchDemoBuilding()
      .then((b) => {
        if (!alive) return;
        if (b.floors.length === 0) throw new Error("The demo building has no floors.");
        setApiFloors(b.floors);
        setApiName(b.name);
      })
      .catch(() => {
        if (!alive) return;
        setFallbackNotice("The demo service is unavailable right now, so this is a locally generated floor. It is still entirely simulated.");
        setMock(true);
      });
    return () => {
      alive = false;
    };
  }, [mock]);

  const loadView = useCallback(
    async (id: string, signal: AbortSignal): Promise<FloorView> => (mock ? buildMockFloorView(id) : fetchFloorView(id, { demo: true, signal })),
    [mock],
  );

  const source: OfficeSource = useMemo(() => {
    let cached: Promise<ReturnType<typeof normalizeScript>> | null = null;
    return {
      kind: "demo",
      loadScript: async (view: FloorView) => {
        if (mock) return view.id === "mock-floor-2" ? [] : buildMockScript();
        cached ??= fetchDemoScript().then(normalizeScript);
        const script = await cached;
        // Only play the steps of employees on this floor (plus floor-less notes).
        const ids = new Set(view.employees.map((e) => e.id));
        return script.filter((s) => !s.employeeId || ids.has(s.employeeId));
      },
    };
  }, [mock]);

  return (
    <OfficeExperience
      floors={floors}
      floorId={floorId}
      onFloorChange={setFloorId}
      buildingName={buildingName}
      loadView={loadView}
      source={source}
      hud={hud}
      bench={bench}
      listView={listView}
      notice={notice}
    />
  );
}
