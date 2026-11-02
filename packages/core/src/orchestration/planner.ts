import { z } from "zod";
import { SPECIALTIES, type Rank, type Specialty } from "@agentopia/shared";

const KEYWORDS: Record<Exclude<Specialty, "MANAGEMENT">, string[]> = {
  FRONTEND: ["frontend", "front-end", "react", "next.js", "nextjs", "component", "css", "tailwind", "ui component", "page", "button", "form", "browser", "accessibility", "a11y", "responsive", "html", "client-side", "landing"],
  BACKEND: ["backend", "back-end", "api", "endpoint", "database", "postgres", "sql", "prisma", "migration", "queue", "redis", "server", "auth", "webhook", "service", "cron", "schema", "node.js"],
  UIUX: ["design", "ux", "ui/ux", "wireframe", "mockup", "figma", "user flow", "visual", "typography", "palette", "prototype", "usability", "style guide", "layout"],
  QA: ["test", "tests", "testing", "qa", "e2e", "playwright", "regression", "bug", "verify", "verification", "quality", "coverage", "vitest"],
  RESEARCH: ["research", "investigate", "compare", "evaluate", "analysis", "survey", "benchmark", "competitor", "summarize", "report", "options", "market"],
};

/** Keyword scores per specialty for a text. */
export function specialtyScores(text: string): Record<Exclude<Specialty, "MANAGEMENT">, number> {
  const t = ` ${text.toLowerCase()} `;
  const out = { FRONTEND: 0, BACKEND: 0, UIUX: 0, QA: 0, RESEARCH: 0 };
  for (const [sp, words] of Object.entries(KEYWORDS) as Array<[keyof typeof out, string[]]>) {
    for (const w of words) {
      const re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^a-z0-9]|$)`, "g");
      out[sp] += (t.match(re)?.length ?? 0) * (w.includes(" ") ? 2 : 1);
    }
  }
  return out;
}

/** Infers the best-fit specialty from a title and description (title weighted ×2); null when nothing matches. */
export function inferSpecialty(title: string, description: string): Specialty | null {
  const a = specialtyScores(title);
  const b = specialtyScores(description);
  let best: Specialty | null = null;
  let bestScore = 0;
  for (const sp of Object.keys(a) as Array<keyof typeof a>) {
    const s = a[sp] * 2 + b[sp];
    if (s > bestScore) {
      best = sp;
      bestScore = s;
    }
  }
  return best;
}

export const RANK_WEIGHT: Record<Rank, number> = { TRAINEE: 0, JUNIOR: 5, MID_LEVEL: 10, SENIOR: 15, EXPERT: 20 };

export interface CandidateInput {
  id: string;
  name: string;
  specialty: Specialty;
  role: "MANAGER" | "EMPLOYEE";
  rank: Rank;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  /** Number of ACTIVE assignments. */
  activeAssignments: number;
  /** Demonstrated evidence count (REVIEW_APPROVED + TASK_COMPLETED). */
  evidenceCount: number;
  /** True if the employee has an enabled skill applicable to the specialty. */
  hasEnabledSkill: boolean;
}

export interface CandidateScore {
  employeeId: string;
  name: string;
  eligible: boolean;
  score: number;
  reasons: string[];
}

/**
 * Scores employees for a task. Eligibility: ACTIVE and specialty match (the
 * manager only matches MANAGEMENT work). Score: availability (+30, or −10 per
 * active assignment), rank weight (0–20), demonstrated evidence (+1 each, max
 * 20), enabled matching skill (+10). Sorted best first; ties by name.
 */
export function scoreCandidates(task: { requiredSpecialty?: Specialty | null; title: string; description: string }, employees: CandidateInput[]): CandidateScore[] {
  const specialty = task.requiredSpecialty ?? inferSpecialty(task.title, task.description);
  return employees
    .map((e): CandidateScore => {
      const reasons: string[] = [];
      let eligible = true;
      if (e.status !== "ACTIVE") {
        eligible = false;
        reasons.push(`status ${e.status}`);
      }
      if (specialty && e.specialty !== specialty) {
        eligible = false;
        reasons.push(`specialty ${e.specialty} ≠ ${specialty}`);
      }
      if (!specialty && e.role === "MANAGER") {
        eligible = false;
        reasons.push("manager delegates generic work");
      }
      let score = 0;
      if (e.activeAssignments === 0) {
        score += 30;
        reasons.push("available");
      } else {
        score -= 10 * e.activeAssignments;
        reasons.push(`${e.activeAssignments} active assignment(s)`);
      }
      score += RANK_WEIGHT[e.rank];
      reasons.push(`rank ${e.rank}`);
      const ev = Math.min(e.evidenceCount, 20);
      score += ev;
      if (ev) reasons.push(`${e.evidenceCount} demonstrated result(s)`);
      if (e.hasEnabledSkill) {
        score += 10;
        reasons.push("has an enabled matching skill");
      }
      if (specialty && e.specialty === specialty) reasons.unshift(`specialty match (${specialty})`);
      return { employeeId: e.id, name: e.name, eligible, score, reasons };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.name.localeCompare(b.name));
}

/** Bounded decomposition schema used for LLM planning output. */
export const PlanSchema = z.object({
  subtasks: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(200),
        description: z.string().trim().min(3).max(4000),
        specialty: z.enum(SPECIALTIES),
        dependsOn: z.array(z.number().int().min(0)).max(6).default([]),
      }),
    )
    .min(1)
    .max(6),
});
export type Plan = z.infer<typeof PlanSchema>;

/** True if the index-based dependency graph has a cycle or an out-of-range/self reference. */
export function hasCycle(deps: number[][]): boolean {
  const n = deps.length;
  const state = new Array<number>(n).fill(0);
  const visit = (i: number): boolean => {
    if (state[i] === 1) return true;
    if (state[i] === 2) return false;
    state[i] = 1;
    for (const d of deps[i] ?? []) {
      if (d < 0 || d >= n || d === i || visit(d)) return true;
    }
    state[i] = 2;
    return false;
  };
  for (let i = 0; i < n; i++) if (visit(i)) return true;
  return false;
}

/** Parses and validates a plan (schema + acyclic dependencies); throws on invalid input. */
export function validatePlan(raw: unknown): Plan {
  const plan = PlanSchema.parse(raw);
  if (hasCycle(plan.subtasks.map((s) => s.dependsOn))) throw new Error("Plan dependencies contain a cycle");
  return plan;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;

/**
 * Deterministic decomposition: when the description lists ≥2 explicit
 * deliverables (bullets/numbered lines) spanning ≥2 specialties, each becomes
 * a subtask (max 6). QA deliverables depend on all non-QA ones. Returns null
 * when the task should stay a single assignment.
 */
export function deterministicDecomposition(title: string, description: string, fallback: Specialty | null): Plan | null {
  const items = description
    .split("\n")
    .map((l) => BULLET.exec(l)?.[1]?.trim())
    .filter((x): x is string => !!x && x.length >= 3)
    .slice(0, 6);
  if (items.length < 2) return null;
  const subtasks = items.map((text) => ({ title: text.slice(0, 120), description: `${text}\n\nPart of: ${title}`, specialty: (inferSpecialty(text, "") ?? fallback ?? "RESEARCH") as Specialty, dependsOn: [] as number[] }));
  if (new Set(subtasks.map((s) => s.specialty)).size < 2) return null;
  const nonQa = subtasks.map((s, i) => (s.specialty === "QA" ? -1 : i)).filter((i) => i >= 0);
  for (const s of subtasks) if (s.specialty === "QA") s.dependsOn = nonQa;
  return validatePlan({ subtasks });
}
