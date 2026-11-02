/**
 * `?mock=1` mode: a FloorView built from DEFAULT_ROOMS with 8 fake employees and
 * a local simulated script, so the scene works before the API exists.
 * Everything here is labelled simulated in the UI.
 */
import { DEFAULT_LAYOUT, DEFAULT_ROOMS, type EmployeeView, type FloorView, type RoomView } from "@agentopia/shared";
import type { DemoScriptItem } from "./demo-player";
import type { FloorSummary } from "./FloorSwitcher";

type Seed = { id: string; name: string; title: string; specialty: string; role: "MANAGER" | "EMPLOYEE"; rank: string; room: number; slot: number; palette: string; hair: number; skin: number; visual: EmployeeView["visualState"] };

const SEEDS: Seed[] = [
  { id: "mock-ada", name: "Ada", title: "Engineering manager", specialty: "MANAGEMENT", role: "MANAGER", rank: "EXPERT", room: 0, slot: 0, palette: "brick", hair: 5, skin: 1, visual: "IDLE" },
  { id: "mock-mina", name: "Mina", title: "Frontend engineer", specialty: "FRONTEND", role: "EMPLOYEE", rank: "MID_LEVEL", room: 1, slot: 0, palette: "sky", hair: 1, skin: 2, visual: "IDLE" },
  { id: "mock-omar", name: "Omar", title: "Backend engineer", specialty: "BACKEND", role: "EMPLOYEE", rank: "SENIOR", room: 1, slot: 1, palette: "ink", hair: 0, skin: 4, visual: "WORKING" },
  { id: "mock-lina", name: "Lina", title: "Frontend engineer", specialty: "FRONTEND", role: "EMPLOYEE", rank: "JUNIOR", room: 1, slot: 4, palette: "plum", hair: 6, skin: 0, visual: "IDLE" },
  { id: "mock-yusuf", name: "Yusuf", title: "Backend engineer", specialty: "BACKEND", role: "EMPLOYEE", rank: "TRAINEE", room: 1, slot: 5, palette: "moss", hair: 3, skin: 3, visual: "IDLE" },
  { id: "mock-sara", name: "Sara", title: "Product designer", specialty: "UIUX", role: "EMPLOYEE", rank: "SENIOR", room: 2, slot: 0, palette: "saffron", hair: 9, skin: 1, visual: "THINKING" },
  { id: "mock-kofi", name: "Kofi", title: "Researcher", specialty: "RESEARCH", role: "EMPLOYEE", rank: "MID_LEVEL", room: 3, slot: 0, palette: "moss", hair: 2, skin: 5, visual: "IDLE" },
  { id: "mock-hana", name: "Hana", title: "QA engineer", specialty: "QA", role: "EMPLOYEE", rank: "MID_LEVEL", room: 5, slot: 1, palette: "sky", hair: 7, skin: 2, visual: "IDLE" },
];

export const MOCK_COMPANY = { id: "mock-company", name: "Northwind Labs", isDemo: true };

export const MOCK_FLOORS: FloorSummary[] = [
  { id: "mock-floor-1", name: "Floor 1", order: 1, companyName: "Northwind Labs" },
  { id: "mock-floor-2", name: "Floor 2", order: 2, companyName: "Paper Crane Studio" },
];

export function buildMockFloorView(floorId = "mock-floor-1"): FloorView {
  const second = floorId === "mock-floor-2";
  const seeds = second ? SEEDS.slice(0, 5).map((s, i) => ({ ...s, id: `${s.id}-2`, name: ["Noor", "Ravi", "Elif", "Tomas", "June"][i]!, palette: ["plum", "moss", "saffron", "brick", "ink"][i]! })) : SEEDS;
  const rooms: RoomView[] = DEFAULT_ROOMS.map((r, i) => ({
    id: `${floorId}-room-${i}`,
    name: r.name,
    kind: r.kind,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    desks: r.deskSlots.map((d, j) => ({ id: `${floorId}-desk-${i}-${j}`, x: d.x, y: d.y, facing: d.facing, employeeId: null as string | null })),
  }));
  const employees: EmployeeView[] = seeds.map((s) => {
    const desk = rooms[s.room]?.desks[s.slot];
    if (desk) desk.employeeId = s.id;
    return {
      id: s.id,
      name: s.name,
      title: s.title,
      specialty: s.specialty,
      role: s.role,
      rank: s.rank,
      status: "ACTIVE",
      visualState: s.visual,
      avatar: { palette: s.palette, hair: s.hair, skin: s.skin },
      deskId: desk?.id ?? null,
      currentTaskId: s.visual === "WORKING" ? "mock-task-api" : s.visual === "THINKING" ? "mock-task-onboarding" : null,
      provider: "SIMULATED",
    };
  });
  return {
    id: floorId,
    name: second ? "Floor 2" : "Floor 1",
    order: second ? 2 : 1,
    buildingId: "mock-building",
    company: second ? { id: "mock-company-2", name: "Paper Crane Studio", isDemo: true } : MOCK_COMPANY,
    layout: DEFAULT_LAYOUT,
    rooms,
    employees,
    taskSummary: second ? { active: 1, review: 0, blocked: 0, completedToday: 2 } : { active: 3, review: 1, blocked: 0, completedToday: 4 },
  };
}

const step = (type: DemoScriptItem["type"], employeeId: string, taskId: string, payload: Record<string, unknown>, delayMs: number): DemoScriptItem => ({
  type,
  employeeId,
  taskId,
  payload,
  delayMs,
  simulated: true,
});

/** A loopable script that exercises every visual state on floor 1. */
export function buildMockScript(suffix = ""): DemoScriptItem[] {
  const id = (s: string) => `mock-${s}${suffix}`;
  const t1 = { title: "Fix header" };
  const t2 = { title: "Usability notes" };
  const t3 = { title: "Checkout API" };
  return [
    step("task.created", id("ada"), "mock-task-header", t1, 800),
    step("task.assigned", id("mina"), "mock-task-header", { ...t1, assigneeId: id("mina") }, 900),
    step("task.started", id("mina"), "mock-task-header", t1, 1600),
    step("execution.tool_use", id("mina"), "mock-task-header", { ...t1, tool: "Edit" }, 1800),
    step("task.assigned", id("kofi"), "mock-task-research", { ...t2, assigneeId: id("kofi") }, 700),
    step("task.started", id("kofi"), "mock-task-research", t2, 1400),
    step("task.waiting_approval", id("omar"), "mock-task-api", t3, 1200),
    step("task.handoff", id("mina"), "mock-task-header", { ...t1, fromEmployeeId: id("mina"), toEmployeeId: id("ada"), artifactIds: [], summary: "Header fixed" }, 2200),
    step("task.review_started", id("ada"), "mock-task-header", { ...t1, reviewerId: id("ada") }, 2600),
    step("task.started", id("omar"), "mock-task-api", t3, 1200),
    step("task.review_decided", id("ada"), "mock-task-header", { ...t1, reviewerId: id("ada"), assigneeId: id("mina"), approved: true }, 2400),
    step("task.completed", id("mina"), "mock-task-header", t1, 900),
    step("task.assigned", id("hana"), "mock-task-qa", { title: "Regression pass", assigneeId: id("hana") }, 800),
    step("task.started", id("hana"), "mock-task-qa", { title: "Regression pass" }, 1300),
    step("task.failed", id("hana"), "mock-task-qa", { title: "Regression pass", message: "Simulated failure" }, 2800),
    step("task.handoff", id("kofi"), "mock-task-research", { ...t2, fromEmployeeId: id("kofi"), toEmployeeId: id("ada"), artifactIds: [], summary: "Notes" }, 1800),
    step("task.review_started", id("ada"), "mock-task-research", { ...t2, reviewerId: id("ada") }, 2600),
    step("task.review_decided", id("ada"), "mock-task-research", { ...t2, reviewerId: id("ada"), assigneeId: id("kofi"), approved: false }, 1800),
    step("task.completed", id("omar"), "mock-task-api", t3, 2400),
    step("task.handoff", id("kofi"), "mock-task-research", { ...t2, fromEmployeeId: id("kofi"), toEmployeeId: id("ada"), artifactIds: [], summary: "Notes v2" }, 3500),
    step("task.review_decided", id("ada"), "mock-task-research", { ...t2, reviewerId: id("ada"), assigneeId: id("kofi"), approved: true }, 3000),
    step("task.completed", id("kofi"), "mock-task-research", t2, 900),
    step("employee.state", id("hana"), "mock-task-qa", { state: "IDLE", taskId: null }, 2000),
  ];
}
