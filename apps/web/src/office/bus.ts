import type { TaskEvent } from "@agentopia/shared";

export type EventBus = { emit(e: TaskEvent): void; subscribe(fn: (e: TaskEvent) => void): () => void };

export function createEventBus(): EventBus {
  const subs = new Set<(e: TaskEvent) => void>();
  return {
    emit(e) {
      for (const fn of subs) fn(e);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
}
