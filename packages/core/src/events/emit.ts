import { prisma, Prisma, type TaskEvent as TaskEventRow, type VisualState } from "@agentopia/db";
import { EVENT_TO_VISUAL, VISUAL_STATES, type EventType, type TaskEvent } from "@agentopia/shared";
import { publishEvents } from "./bus";

/** Root client or interactive-transaction client. */
export type DbClient = Prisma.TransactionClient | typeof prisma;

export interface EmitInput {
  companyId: string;
  taskId?: string | null;
  employeeId?: string | null;
  type: EventType;
  payload?: object;
  /** Seeded/visitor simulation only. Stored in payload as `simulated: true`. */
  simulated?: boolean;
}

/** Serializes a TaskEvent row into the wire shape (seq as number, ISO createdAt). */
export function serializeEvent(row: TaskEventRow): TaskEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const out: TaskEvent = {
    seq: Number(row.seq),
    id: row.id,
    companyId: row.companyId,
    taskId: row.taskId,
    employeeId: row.employeeId,
    type: row.type as EventType,
    payload,
    createdAt: row.createdAt.toISOString(),
  };
  if (payload.simulated === true) out.simulated = true;
  return out;
}

function isRootClient(db: DbClient): db is typeof prisma {
  return typeof (db as { $transaction?: unknown }).$transaction === "function";
}

function visualFor(e: EmitInput): VisualState | undefined {
  if (e.type === "employee.state") {
    const s = (e.payload as { state?: string } | undefined)?.state;
    return s && (VISUAL_STATES as readonly string[]).includes(s) ? (s as VisualState) : undefined;
  }
  return EVENT_TO_VISUAL[e.type] as VisualState | undefined;
}

/**
 * Persists a TaskEvent and projects Employee.visualState via EVENT_TO_VISUAL.
 *
 * Publishing: when `db` is the root Prisma client the event is published to
 * Redis (`events:<companyId>`) right after the write. When `db` is a
 * transaction client the event is NOT published here (the transaction may
 * still roll back): use `withEvents()` which buffers events emitted inside the
 * transaction and publishes them after commit.
 */
export async function emitEvent(db: DbClient, e: EmitInput): Promise<TaskEvent> {
  const payload: Record<string, unknown> = { ...(e.payload ?? {}) };
  if (e.simulated) payload.simulated = true;
  const row = await db.taskEvent.create({
    data: {
      companyId: e.companyId,
      taskId: e.taskId ?? null,
      employeeId: e.employeeId ?? null,
      type: e.type,
      payload: payload as Prisma.InputJsonValue,
    },
  });
  const visual = e.employeeId ? visualFor(e) : undefined;
  if (visual && e.employeeId) {
    await db.employee.updateMany({ where: { id: e.employeeId, companyId: e.companyId }, data: { visualState: visual } });
  }
  const ev = serializeEvent(row);
  if (isRootClient(db)) await publishEvents([ev]);
  return ev;
}

/** Emit function bound to a transaction, buffering for post-commit publish. */
export type TxEmit = (e: EmitInput) => Promise<TaskEvent>;

/**
 * Runs `fn` in an interactive transaction; events emitted through the provided
 * `emit` are persisted inside the transaction and published only after commit.
 */
export async function withEvents<T>(fn: (tx: Prisma.TransactionClient, emit: TxEmit) => Promise<T>, opts?: { timeout?: number }): Promise<T> {
  const buffer: TaskEvent[] = [];
  const result = await prisma.$transaction(
    async (tx) => {
      const emit: TxEmit = async (e) => {
        const ev = await emitEvent(tx, e);
        buffer.push(ev);
        return ev;
      };
      return fn(tx, emit);
    },
    { timeout: opts?.timeout ?? 15000 },
  );
  await publishEvents(buffer);
  return result;
}
