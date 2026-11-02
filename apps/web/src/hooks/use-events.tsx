"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { streamCompanyEvents } from "@/lib/api-client";
import type { TaskEventView } from "@/lib/api-types";

/** An event as received from SSE (TaskEventSchema JSON). */
export type TaskEvent = TaskEventView;

const MAX_EVENTS = 200;
const EMPTY: TaskEvent[] = [];
const INVALIDATE_DEBOUNCE_MS = 400;

export type StreamStatus = "idle" | "connecting" | "open" | "reconnecting";

type Listener = (event: TaskEvent) => void;

type EventsContextValue = {
  /** Most recent events, oldest first, capped at 200. */
  events: TaskEvent[];
  status: StreamStatus;
  lastSeq: number | null;
  /** Subscribe to every incoming event (used by the office scene). Returns an unsubscribe. */
  subscribe: (listener: Listener) => () => void;
};

const EventsContext = createContext<EventsContextValue | null>(null);

/** Query-key prefixes to refresh for an event type. */
function keysFor(companyId: string, type: string): QueryKey[] {
  const base = ["company", companyId];
  if (type === "task.progress" || type === "execution.message" || type === "execution.tool_use") {
    // High-frequency events: only the open task timeline needs them.
    return [[...base, "tasks", "detail"]];
  }
  if (type.startsWith("task.") || type.startsWith("execution.")) {
    const keys: QueryKey[] = [[...base, "tasks"], [...base, "approvals"], [...base, "employees"]];
    if (type === "execution.usage" || type === "execution.ended") keys.push([...base, "usage"]);
    if (type === "task.waiting_provider_limit" || type === "execution.started" || type === "execution.ended") keys.push([...base, "providers", "status"]);
    return keys;
  }
  if (type.startsWith("provider.")) return [[...base, "providers"], [...base, "tasks"], [...base, "usage"]];
  if (type.startsWith("employee.")) return [[...base, "employees"]];
  if (type.startsWith("knowledge.")) return [[...base, "knowledge"]];
  if (type.startsWith("learning.")) return [[...base, "learning"], [...base, "knowledge"]];
  if (type.startsWith("runner.")) return [[...base, "runners"], [...base, "providers", "status"]];
  return [];
}

export function CompanyEventsProvider({ companyId, children }: { companyId: string | null; children: ReactNode }) {
  const qc = useQueryClient();
  // Buffer and status are tagged with the company they belong to, so switching
  // floors shows an empty buffer immediately without resetting state in the effect.
  const [buffer, setBuffer] = useState<{ companyId: string | null; events: TaskEvent[] }>({ companyId: null, events: [] });
  const [streamState, setStreamState] = useState<{ companyId: string | null; status: StreamStatus }>({ companyId: null, status: "idle" });
  const events = buffer.companyId === companyId ? buffer.events : EMPTY;
  const status: StreamStatus = !companyId ? "idle" : streamState.companyId === companyId ? streamState.status : "connecting";
  const lastSeqRef = useRef<number | null>(null);
  const listeners = useRef(new Set<Listener>());
  const pending = useRef(new Map<string, QueryKey>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    const keys = [...pending.current.values()];
    pending.current.clear();
    for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
  }, [qc]);

  useEffect(() => {
    if (!companyId) return;
    lastSeqRef.current = null;
    const pendingKeys = pending.current;
    const setStatus = (status: StreamStatus) =>
      setStreamState((prev) => (prev.companyId === companyId && prev.status === status ? prev : { companyId, status }));
    // The first connect sends no cursor, so the server replays only the most recent events
    // for context; reconnects resume from the last seq received. Replayed events fill the
    // buffer but do not trigger refetches; only fresh ones do.
    const liveSince = Date.now() - 5_000;

    const stop = streamCompanyEvents(
      companyId,
      null,
      (event: TaskEvent) => {
        setStatus("open");
        const seq = Number(event.seq);
        if (lastSeqRef.current !== null && seq <= lastSeqRef.current) return; // replay duplicate
        lastSeqRef.current = seq;
        setBuffer((prev) => {
          const base = prev.companyId === companyId ? prev.events : EMPTY;
          const next = base.length >= MAX_EVENTS ? base.slice(base.length - MAX_EVENTS + 1) : base.slice();
          next.push(event);
          return { companyId, events: next };
        });
        for (const l of listeners.current) l(event);
        if (Date.parse(event.createdAt) < liveSince) return;
        for (const key of keysFor(companyId, event.type)) pendingKeys.set(JSON.stringify(key), key);
        if (!timer.current) timer.current = setTimeout(flush, INVALIDATE_DEBOUNCE_MS);
      },
      { onOpen: () => setStatus("open"), onError: () => setStatus("reconnecting") },
    );

    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendingKeys.clear();
    };
  }, [companyId, flush]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<EventsContextValue>(
    () => ({ events, status, lastSeq: events.length ? Number(events[events.length - 1].seq) : null, subscribe }),
    [events, status, subscribe],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

/** Live events for the current company: `{ events, status, lastSeq, subscribe }`. */
export function useCompanyEvents(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useCompanyEvents() must be used inside the (app) layout.");
  return ctx;
}

/** Like useCompanyEvents(), but null outside the (app) layout (e.g. the public demo office). */
export function useOptionalCompanyEvents(): EventsContextValue | null {
  return useContext(EventsContext);
}
