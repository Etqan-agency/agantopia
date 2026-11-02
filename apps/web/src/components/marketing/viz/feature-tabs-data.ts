import type { ReactNode } from "react";

export type FeatureTab = {
  id: string;
  /** Short tab label, e.g. "Delegate". */
  label: string;
  title: string;
  body: string;
  bullets: string[];
  /** A ScreenshotFrame, a viz component, or anything else. */
  media?: ReactNode;
};

/** Default copy, restating src/content/marketing (home + feature pages). */
export const DEFAULT_FEATURE_TABS: FeatureTab[] = [
  {
    id: "manage",
    label: "Manage",
    title: "Employees you can read and edit",
    body: "Hire from six role templates. Every employee has an eleven-field prompt, skills and knowledge you can open and change.",
    bullets: ["Versioned prompts with rollback", "Assigned proficiency kept apart from demonstrated skill", "An office room that matches each specialty"],
  },
  {
    id: "delegate",
    label: "Delegate",
    title: "A manager that plans and assigns",
    body: "Give the manager a task. It splits the work into subtasks with dependencies and gives each to the best-fit specialist.",
    bullets: ["Specialty, availability, then rank and evidence", "Circular plans are rejected", "No fit means blocked with a reason, not forced on the wrong person"],
  },
  {
    id: "collaborate",
    label: "Collaborate",
    title: "Specialists that hand work on",
    body: "Subtasks wait for the work they depend on. Each handoff carries a short summary and the artifacts.",
    bullets: ["Handoffs recorded as their own assignments", "Risky actions pause as Waiting for approval", "The office and feed show the same events"],
  },
  {
    id: "learn",
    label: "Learn",
    title: "Knowledge you approve",
    body: "On a schedule, employees read allowlisted docs and repositories in their specialty and draft notes for your approval.",
    bullets: ["Unchanged pages are skipped", "Only approved notes become verified memory", "The model itself is not retrained"],
  },
  {
    id: "review",
    label: "Review",
    title: "Checked before it counts",
    body: "A QA employee or the manager reviews every deliverable against the definition of done before the task completes.",
    bullets: ["Approve, or send back with notes", "Attempt limits and timeouts stop loops", "A timeline of persisted events for every task"],
  },
];
