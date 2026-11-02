import type { RoomKind, VisualState } from "./enums";

/** Tile-based floor layout projection stored on Floor.layout (JSON). */
export type FloorLayout = {
  tileSize: number; // px per tile at zoom 1 (32)
  width: number; // tiles
  height: number; // tiles
  theme: "warm" | "cool";
  /** Optional decorative props: plants, printers, coffee machine etc. */
  props?: Array<{ kind: string; x: number; y: number }>;
};

export type RoomView = {
  id: string;
  name: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  desks: DeskView[];
};

export type DeskView = {
  id: string;
  x: number;
  y: number;
  facing: "up" | "down" | "left" | "right";
  employeeId: string | null;
};

export type EmployeeView = {
  id: string;
  name: string;
  title: string;
  specialty: string;
  role: "MANAGER" | "EMPLOYEE";
  rank: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  visualState: VisualState;
  avatar: { palette: string; hair: number; skin: number; accessory?: string };
  deskId: string | null;
  currentTaskId: string | null;
  provider: string | null;
};

export type FloorView = {
  id: string;
  name: string;
  order: number;
  buildingId: string;
  company: { id: string; name: string; isDemo: boolean } | null;
  layout: FloorLayout;
  rooms: RoomView[];
  employees: EmployeeView[];
  taskSummary: { active: number; review: number; blocked: number; completedToday: number };
};

export const DEFAULT_LAYOUT: FloorLayout = { tileSize: 32, width: 40, height: 24, theme: "warm" };

/** Default room arrangement for a new floor (tile coordinates). */
export const DEFAULT_ROOMS: Array<Omit<RoomView, "id" | "desks"> & { deskSlots: Array<{ x: number; y: number; facing: DeskView["facing"] }> }> = [
  { name: "Manager's office", kind: "MANAGER_OFFICE", x: 1, y: 1, w: 9, h: 7, deskSlots: [{ x: 5, y: 4, facing: "down" }] },
  { name: "Development", kind: "DEVELOPMENT", x: 11, y: 1, w: 17, h: 9, deskSlots: [
    { x: 14, y: 3, facing: "down" }, { x: 18, y: 3, facing: "down" }, { x: 22, y: 3, facing: "down" },
    { x: 14, y: 7, facing: "up" }, { x: 18, y: 7, facing: "up" }, { x: 22, y: 7, facing: "up" },
  ] },
  { name: "Design", kind: "DESIGN", x: 29, y: 1, w: 10, h: 9, deskSlots: [{ x: 32, y: 3, facing: "down" }, { x: 36, y: 3, facing: "down" }, { x: 32, y: 7, facing: "up" }] },
  { name: "Research", kind: "RESEARCH", x: 1, y: 9, w: 9, h: 7, deskSlots: [{ x: 3, y: 12, facing: "right" }, { x: 7, y: 12, facing: "left" }] },
  { name: "Shared space", kind: "SHARED", x: 11, y: 11, w: 17, h: 6, deskSlots: [] },
  { name: "QA lab", kind: "QA", x: 29, y: 11, w: 10, h: 6, deskSlots: [{ x: 32, y: 13, facing: "down" }, { x: 36, y: 13, facing: "down" }] },
  { name: "Lounge", kind: "LOUNGE", x: 1, y: 17, w: 38, h: 6, deskSlots: [] },
];

/** Authoritative mapping from task/execution events to employee visual state. */
export const EVENT_TO_VISUAL: Record<string, VisualState | undefined> = {
  "task.assigned": "THINKING",
  "task.started": "WORKING",
  "execution.started": "WORKING",
  "execution.tool_use": "WORKING",
  "task.waiting_approval": "WAITING_APPROVAL",
  "task.waiting_provider_limit": "BLOCKED",
  "task.handoff": "COLLABORATING",
  "task.review_started": "REVIEWING",
  "task.completed": "COMPLETED",
  "task.failed": "BLOCKED",
  "task.blocked": "BLOCKED",
  "task.cancelled": "IDLE",
};
