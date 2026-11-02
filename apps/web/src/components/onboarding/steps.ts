export const STEPS = [
  { id: "account", title: "Account", hint: "Who owns the company" },
  { id: "company", title: "Company and floor", hint: "Name the company and its first floor" },
  { id: "provider", title: "Connect a provider", hint: "Your Claude Code or Codex sign-in, an API key, or simulated" },
  { id: "model", title: "Model and permissions", hint: "What employees may do on their own" },
  { id: "test", title: "Run a test task", hint: "Watch one task go through the office" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export function isStep(v: string | null): v is StepId {
  return STEPS.some((s) => s.id === v);
}
