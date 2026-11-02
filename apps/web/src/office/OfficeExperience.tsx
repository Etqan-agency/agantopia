"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FloorView, TaskEvent } from "@agentopia/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { createEventBus } from "./bus";
import { ANNOUNCE_TYPES, describeEvent, initialLive, projectLive, titleFromEvent, type LiveEmployee, type Lookup } from "./describe";
import { createDemoPlayer, type DemoPlayer, type DemoScriptItem } from "./demo-player";
import { DemoAccountDialog } from "./DemoAccountDialog";
import { EmployeePanel } from "./EmployeePanel";
import { EventFeed } from "./EventFeed";
import { FloorSwitcher, type FloorSummary } from "./FloorSwitcher";
import { NewTaskDialog } from "./NewTaskDialog";
import { OfficeListView } from "./OfficeListView";
import { useOptionalCompanyEvents } from "@/hooks/use-events";
import type { TaskEventView } from "@/lib/api-types";
import { officeStreamStatus, toOfficeEvent } from "./stream";

const OfficeCanvas = dynamic(() => import("./OfficeCanvas").then((m) => m.OfficeCanvas), {
  ssr: false,
  loading: () => <div className="grid min-h-[420px] flex-1 place-items-center rounded-lg border border-rule text-sm text-fg-muted">Opening the office…</div>,
});

const noopSubscribe = () => () => {};

const STATIC_KEY = "agentopia.office.static";
const OPT_IN_KEY = "agentopia.office.canvasOptIn";
const MAX_EVENTS = 200;

function useMedia(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export type OfficeSource =
  | { kind: "live" }
  | { kind: "demo"; loadScript: (view: FloorView) => Promise<DemoScriptItem[]> };

export type OfficeExperienceProps = {
  floors: FloorSummary[];
  floorId: string | null;
  onFloorChange: (floorId: string) => void;
  buildingName?: string;
  loadView: (floorId: string, signal: AbortSignal) => Promise<FloorView>;
  source: OfficeSource;
  hud?: boolean;
  bench?: boolean;
  notice?: string | null;
  /** `?view=list`: start in the list view (the person can still opt into the canvas). */
  listView?: boolean;
};

export function OfficeExperience({ floors, floorId, onFloorChange, buildingName, loadView, source, hud = false, bench = false, notice, listView = false }: OfficeExperienceProps) {
  const isDemoSource = source.kind === "demo";
  const [view, setView] = useState<FloorView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [live, setLive] = useState<Record<string, LiveEmployee>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  // Read lazily; anything that depends on them only renders after hydration (`mounted`).
  const [staticView, setStaticView] = useState(() => listView || readFlag(STATIC_KEY));
  const [optIn, setOptIn] = useState(() => readFlag(OPT_IN_KEY));
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Live events come from the app shell's single SSE connection (absent on the public demo).
  const companyEvents = useOptionalCompanyEvents();
  const subscribeEvents = companyEvents?.subscribe;
  const streamStatus = officeStreamStatus(companyEvents?.status);
  const eventBufferRef = useRef<TaskEventView[]>([]);
  useLayoutEffect(() => {
    eventBufferRef.current = companyEvents?.events ?? [];
  }, [companyEvents?.events]);
  const [taskDialog, setTaskDialog] = useState(false);
  const [demoDialog, setDemoDialog] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const bus = useMemo(() => createEventBus(), []);
  const playerRef = useRef<DemoPlayer | null>(null);
  const viewRef = useRef<FloorView | null>(null);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);

  const narrow = useMedia("(max-width: 899px)", false);
  const prefersReduced = useMedia("(prefers-reduced-motion: reduce)", false);

  // Load the floor view.
  useEffect(() => {
    if (!floorId) return;
    const ac = new AbortController();
    loadView(floorId, ac.signal)
      .then((v) => {
        if (ac.signal.aborted) return;
        setError(null);
        // A different floor starts with an empty feed.
        if (viewRef.current?.id !== v.id) setEvents([]);
        setView(v);
        setLive(initialLive(v.employees));
        setSelectedId((id) => (id && v.employees.some((e) => e.id === id) ? id : null));
      })
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "Could not load this floor.");
      });
    return () => ac.abort();
  }, [floorId, loadView, reloadKey]);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of view?.employees ?? []) m.set(e.id, e.name);
    return m;
  }, [view]);
  const lookup: Lookup = useMemo(
    () => ({ name: (id) => (id ? names.get(id) ?? null : null), title: (id) => (id ? titles[id] ?? null : null) }),
    [names, titles],
  );
  const lookupRef = useRef(lookup);
  useLayoutEffect(() => {
    lookupRef.current = lookup;
  }, [lookup]);

  const dispatch = useCallback(
    (e: TaskEvent) => {
      const t = titleFromEvent(e);
      if (t && e.taskId) setTitles((m) => (m[e.taskId!] === t ? m : { ...m, [e.taskId!]: t }));
      setEvents((prev) => {
        const next = prev.length >= MAX_EVENTS ? prev.slice(prev.length - MAX_EVENTS + 1) : prev.slice();
        next.push(e);
        return next;
      });
      setLive((prev) => projectLive(prev, e));
      bus.emit(e);
      if (ANNOUNCE_TYPES.has(e.type)) {
        const l = lookupRef.current;
        const sentence = describeEvent(e, { name: l.name, title: (id) => t ?? l.title(id) });
        setAnnouncement(`${sentence}${e.simulated ? " (simulated)" : ""}.`);
      }
      if (e.type === "employee.hired" || e.type === "employee.updated") setReloadKey((k) => k + 1);
    },
    [bus],
  );

  // Live event stream (authenticated office).
  const companyId = view?.company?.id ?? null;
  useEffect(() => {
    if (source.kind !== "live" || !companyId || !subscribeEvents) return;
    let last: number | null = null;
    const handle = (raw: TaskEventView) => {
      if (raw.companyId !== companyId) return;
      const e = toOfficeEvent(raw);
      if (!e) return;
      if (last !== null && e.seq <= last) return; // duplicate
      last = e.seq;
      dispatch(e);
    };
    // Catch up on the recent events the shared stream already received, then follow it live.
    for (const e of eventBufferRef.current) handle(e);
    return subscribeEvents(handle);
  }, [source.kind, companyId, dispatch, subscribeEvents]);

  // Demo script player (visitor demo): plays entirely in the browser.
  const viewId = view?.id ?? null;
  useEffect(() => {
    if (source.kind !== "demo" || !viewId || !viewRef.current) return;
    let player: DemoPlayer | null = null;
    let cancelled = false;
    const base = viewRef.current;
    source
      .loadScript(base)
      .then((script) => {
        if (cancelled || script.length === 0) return;
        player = createDemoPlayer({
          script,
          companyId: base.company?.id ?? "demo",
          onEvent: dispatch,
          speed,
          // Each loop starts from the original projection again.
          onLoop: () => {
            setView({ ...base });
            setLive(initialLive(base.employees));
          },
        });
        playerRef.current = player;
        player.start();
        if (paused) player.pause();
      })
      .catch(() => {
        if (!cancelled) setAnnouncement("The demo script could not be loaded.");
      });
    return () => {
      cancelled = true;
      player?.stop();
      playerRef.current = null;
    };
    // speed/paused are applied by the effects below; restarting on them would reset the script.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, viewId, dispatch]);

  useEffect(() => {
    playerRef.current?.setSpeed(speed);
  }, [speed]);
  useEffect(() => {
    if (paused) playerRef.current?.pause();
    else playerRef.current?.resume();
  }, [paused]);

  const selected = view?.employees.find((e) => e.id === selectedId) ?? null;
  const floorEvents = useMemo(() => {
    if (!view) return events;
    return events.filter((e) => !e.employeeId || names.has(e.employeeId));
  }, [events, names, view]);

  // Which view to show.
  let listReason: string | null = null;
  let canShowCanvas = true;
  if (webglFailed) {
    listReason = "This device can't run the office canvas (WebGL is unavailable), so the office is shown as a list.";
    canShowCanvas = false;
  } else if (staticView) listReason = "Static view is on.";
  else if (narrow && !optIn) listReason = "On small screens the office is shown as a list.";
  else if (prefersReduced && !optIn) listReason = "Your system asks for reduced motion, so the office is shown as a list.";
  const showCanvas = mounted && !listReason;

  const showCanvasNow = () => {
    setStaticView(false);
    writeFlag(STATIC_KEY, false);
    if (narrow || prefersReduced) {
      setOptIn(true);
      writeFlag(OPT_IN_KEY, true);
    }
  };

  const isDemo = isDemoSource || Boolean(view?.company?.isDemo);
  const current = floors.find((f) => f.id === floorId);
  const switcherFloors = floors.map((f) => (f.id === view?.id ? { ...f, taskSummary: view.taskSummary, companyName: f.companyName ?? view.company?.name ?? null } : f));

  const actionBtn =
    "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="@container flex min-h-0 flex-1 flex-col gap-3 p-3 min-[900px]:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight">
            {view?.company?.name ?? current?.companyName ?? "Office"}
          </h1>
          <p className="text-sm text-fg-muted">
            {view?.name ?? current?.name ?? ""}
            {view ? ` · ${view.taskSummary.active} active · ${view.taskSummary.review} in review · ${view.taskSummary.blocked} blocked · ${view.taskSummary.completedToday} done today` : ""}
            {source.kind === "live" && streamStatus && streamStatus !== "open" ? ` · live updates ${streamStatus}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDemoSource ? (
            <>
              <button type="button" className={`${actionBtn} border border-rule-strong hover:bg-surface-sunken`} onClick={() => setDemoDialog("Connecting a provider")}>
                Connect a provider
              </button>
              <button type="button" className={`${actionBtn} bg-gold text-navy hover:bg-gold-deep`} onClick={() => setDemoDialog("Running a task")}>
                Run a task
              </button>
            </>
          ) : companyId ? (
            <button type="button" className={`${actionBtn} bg-gold text-navy hover:bg-gold-deep`} onClick={() => setTaskDialog(true)}>
              New task
            </button>
          ) : null}
        </div>
      </header>
      {notice ? (
        <p className="flex items-center gap-2 rounded-md bg-navy px-3 py-2 text-sm text-snow">
          <span className="shrink-0 rounded-full border border-dashed border-gold bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">Simulated</span>
          {notice}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 min-[900px]:grid-cols-[220px_minmax(0,1fr)] @min-[1320px]:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-3">
          <FloorSwitcher floors={switcherFloors} currentId={floorId} onSelect={onFloorChange} buildingName={buildingName} />
        </div>

        <div className="flex min-h-[480px] min-w-0 flex-col">
          {error ? (
            <div role="alert" className="rounded-lg border border-rule bg-brick-wash p-4 text-sm text-brick-ink">
              {error}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setError(null);
                  setReloadKey((k) => k + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : !view ? (
            floorId ? (
              <div role="status" aria-live="polite" className="flex flex-1 flex-col">
                <span className="sr-only">Loading floor</span>
                <Skeleton className="min-h-[480px] w-full flex-1 rounded-lg" />
              </div>
            ) : (
              <div className="grid flex-1 place-items-center rounded-lg border border-rule text-sm text-fg-muted">No floor selected.</div>
            )
          ) : showCanvas ? (
            <OfficeCanvas
              view={view}
              bus={bus}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAnnounce={setAnnouncement}
              onUnavailable={() => setWebglFailed(true)}
              onStaticView={() => {
                setStaticView(true);
                writeFlag(STATIC_KEY, true);
              }}
              reducedMotion={prefersReduced}
              speed={speed}
              onSpeedChange={setSpeed}
              paused={paused}
              onPausedChange={setPaused}
              hud={hud}
              bench={bench}
              simulated={isDemo}
            />
          ) : (
            <OfficeListView
              view={view}
              live={live}
              titles={(id) => (id ? titles[id] ?? null : null)}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onShowCanvas={canShowCanvas && mounted ? showCanvasNow : undefined}
              reason={mounted ? listReason ?? undefined : undefined}
            />
          )}
        </div>

        {/* Wide layout: the side column is positioned absolutely inside its grid cell so it adds no
            height of its own. The row is as tall as the floor, and the feed scrolls inside it
            instead of stretching the page. */}
        <div className="min-h-0 min-[900px]:col-span-2 @min-[1320px]:relative @min-[1320px]:col-span-1">
         <div className="flex min-h-0 flex-col gap-3 @min-[1320px]:absolute @min-[1320px]:inset-0">
          {selected ? (
            <EmployeePanel
              employee={selected}
              live={live[selected.id]}
              taskTitle={(() => {
                const id = live[selected.id]?.currentTaskId ?? selected.currentTaskId;
                return id ? titles[id] ?? null : null;
              })()}
              links={!isDemoSource}
              onClose={() => setSelectedId(null)}
            />
          ) : null}
          <div className="flex max-h-[420px] min-h-[200px] flex-col @min-[1320px]:min-h-0 @min-[1320px]:max-h-none @min-[1320px]:flex-1">
            <EventFeed events={floorEvents} lookup={lookup} isDemo={isDemo} />
          </div>
         </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      {companyId && !isDemoSource ? <NewTaskDialog open={taskDialog} companyId={companyId} onClose={() => setTaskDialog(false)} /> : null}
      {isDemoSource ? <DemoAccountDialog open={demoDialog !== null} action={demoDialog ?? "This"} onClose={() => setDemoDialog(null)} /> : null}
    </div>
  );
}
