"use client";

/**
 * React Query hooks for every screen, coded against docs/api.md.
 * All company-scoped keys start with ["company", companyId, ...] so the SSE
 * hook can invalidate a whole area with one prefix.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/utils";
import type { z } from "zod";
import type {
  CreateCompanyInput,
  CreateFloorInput,
  CreateKnowledgeInput,
  CreateLearningSourceInput,
  CreatePromptVersionInput,
  CreateProjectInput,
  CreateProviderConnectionInput,
  CreateRunnerInput,
  CreateTaskInput,
  DecideApprovalInput,
  DecideKnowledgeInput,
  HireEmployeeInput,
  OverrideRankInput,
  SetEmployeeSkillsInput,
  TaskActionInput,
  UpdateCompanyInput,
  UpdateEmployeeInput,
  UpdateFloorInput,
  UpdateProviderConnectionInput,
  UpsertLearningScheduleInput,
} from "@agentopia/shared";
import { api } from "@/lib/api-client";
import type {
  ApprovalRequest,
  CareerEvidence,
  CompanyView,
  CreatedRunner,
  CreateCompanyResponse,
  EmployeeDetail,
  EmployeeListItem,
  KnowledgeEntryView,
  LearningRunView,
  LearningScheduleView,
  LearningSourceView,
  MeResponse,
  MemoryHit,
  Paginated,
  Project,
  PromptVersion,
  ProviderConnectionView,
  ProviderStatusView,
  ReconnectProviderResponse,
  RunnerView,
  Skill,
  TaskDetail,
  TaskListItem,
  TaskTimelineEvent,
  UsageSummary,
  VerifyResult,
} from "./api-shapes";

type In<T extends z.ZodType> = z.input<T>;

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

/** Every path below is the full same-origin path, e.g. "/api/me". */
const API = "/api";

function qs(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Lists are documented as `{ items, nextCursor }`; tolerate a bare array too. */
function items<T>(data: Paginated<T> | T[] | undefined | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.items ?? []);
}

/**
 * A cursor-paginated list (`{ items, nextCursor }`, id cursors). `data` is the flattened item
 * array of every page loaded so far; `hasNextPage` / `fetchNextPage` load the next (older) page.
 * An SSE invalidation refetches every loaded page, so nothing the user already saw disappears.
 */
function useCursorList<T>(queryKey: QueryKey, path: (cursor: string | undefined) => string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.get<Paginated<T> | T[]>(path(pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (Array.isArray(last) ? undefined : (last?.nextCursor ?? undefined)),
    select: (d) => d.pages.flatMap((p) => items(p)),
    enabled,
  });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return api.put<T>(path, body);
}

export const qk = {
  me: ["me"] as const,
  company: (cid: string) => ["company", cid] as const,
  companyDetail: (cid: string) => ["company", cid, "detail"] as const,
  employees: (cid: string, f?: object) => ["company", cid, "employees", f ?? {}] as const,
  employee: (cid: string, eid: string) => ["company", cid, "employees", "detail", eid] as const,
  promptVersions: (cid: string, eid: string) => ["company", cid, "employees", "detail", eid, "prompt-versions"] as const,
  evidence: (cid: string, eid: string) => ["company", cid, "employees", "detail", eid, "evidence"] as const,
  employeeTasks: (cid: string, eid: string) => ["company", cid, "employees", "detail", eid, "tasks"] as const,
  skills: (cid: string) => ["company", cid, "skills"] as const,
  projects: (cid: string) => ["company", cid, "projects"] as const,
  tasks: (cid: string, f?: object) => ["company", cid, "tasks", f ?? {}] as const,
  task: (cid: string, tid: string) => ["company", cid, "tasks", "detail", tid] as const,
  taskEvents: (cid: string, tid: string) => ["company", cid, "tasks", "detail", tid, "events"] as const,
  approvals: (cid: string, status?: string) => ["company", cid, "approvals", status ?? "all"] as const,
  providers: (cid: string) => ["company", cid, "providers"] as const,
  providerStatus: (cid: string) => ["company", cid, "providers", "status"] as const,
  runners: (cid: string) => ["company", cid, "runners"] as const,
  usage: (cid: string, range?: object) => ["company", cid, "usage", range ?? {}] as const,
  schedules: (cid: string) => ["company", cid, "learning", "schedules"] as const,
  sources: (cid: string) => ["company", cid, "learning", "sources"] as const,
  runs: (cid: string, employeeId?: string) => ["company", cid, "learning", "runs", employeeId ?? "all"] as const,
  knowledge: (cid: string, f?: object) => ["company", cid, "knowledge", f ?? {}] as const,
  memorySearch: (cid: string, f: object) => ["company", cid, "memory", f] as const,
};

const c = (cid: string) => `${API}/companies/${encodeURIComponent(cid)}`;

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

// ---------------------------------------------------------------------------
// Me / buildings / floors / companies
// ---------------------------------------------------------------------------

export function useMe(enabled = true) {
  return useQuery({ queryKey: qk.me, queryFn: () => api.get<MeResponse>(`${API}/me`), enabled });
}

export function useCompanyDetail(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.companyDetail(cid ?? ""),
    queryFn: () => api.get<CompanyView>(c(cid!)),
    enabled: !!cid,
  });
}

export function useCreateCompany() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateCompanyInput>) =>
      api.post<CreateCompanyResponse>(`${API}/companies`, body),
    onSuccess: () => inv(qk.me),
  });
}

export function useUpdateCompany(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof UpdateCompanyInput>) => api.patch<CompanyView>(c(cid), body),
    onSuccess: () => inv(qk.companyDetail(cid), qk.me),
  });
}

export function useArchiveCompany() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (cid: string) => api.del<unknown>(c(cid)),
    onSuccess: () => inv(qk.me),
  });
}

export function useCreateBuilding() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: { name: string }) => api.post<{ id: string }>(`${API}/buildings`, body),
    onSuccess: () => inv(qk.me),
  });
}

export function useRenameBuilding() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<unknown>(`${API}/buildings/${id}`, { name }),
    onSuccess: () => inv(qk.me),
  });
}

export function useCreateFloor() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateFloorInput>) => api.post<{ id: string }>(`${API}/floors`, body),
    onSuccess: () => inv(qk.me),
  });
}

export function useUpdateFloor() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: In<typeof UpdateFloorInput> & { id: string }) => api.patch<unknown>(`${API}/floors/${id}`, body),
    onSuccess: () => inv(qk.me),
  });
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export function useEmployees(cid: string | null | undefined, filters: { status?: string; specialty?: string } = {}) {
  return useQuery({
    queryKey: qk.employees(cid ?? "", filters),
    queryFn: () =>
      api.get<Paginated<EmployeeListItem> | EmployeeListItem[]>(`${c(cid!)}/employees${qs({ ...filters, limit: 100 })}`),
    select: items,
    enabled: !!cid,
  });
}

export function useEmployee(cid: string | null | undefined, eid: string) {
  return useQuery({
    queryKey: qk.employee(cid ?? "", eid),
    queryFn: () => api.get<EmployeeDetail>(`${c(cid!)}/employees/${eid}`),
    enabled: !!cid && !!eid,
  });
}

export function useHireEmployee(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof HireEmployeeInput>) => api.post<EmployeeListItem>(`${c(cid)}/employees`, body),
    onSuccess: () => inv(["company", cid, "employees"]),
  });
}

export function useUpdateEmployee(cid: string, eid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof UpdateEmployeeInput>) => api.patch<EmployeeDetail>(`${c(cid)}/employees/${eid}`, body),
    onSuccess: () => inv(["company", cid, "employees"]),
  });
}

export function usePromptVersions(cid: string | null | undefined, eid: string) {
  return useQuery({
    queryKey: qk.promptVersions(cid ?? "", eid),
    queryFn: () => api.get<Paginated<PromptVersion> | PromptVersion[]>(`${c(cid!)}/employees/${eid}/prompt-versions${qs({ limit: 100 })}`),
    select: (d) => items(d).slice().sort((a, b) => b.version - a.version),
    enabled: !!cid && !!eid,
  });
}

export function useCreatePromptVersion(cid: string, eid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreatePromptVersionInput>) => api.post<PromptVersion>(`${c(cid)}/employees/${eid}/prompt-versions`, body),
    onSuccess: () => inv(qk.employee(cid, eid)),
  });
}

export function useRollbackPrompt(cid: string, eid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (version: number) => api.post<PromptVersion>(`${c(cid)}/employees/${eid}/prompt-versions/${version}/rollback`, {}),
    onSuccess: () => inv(qk.employee(cid, eid)),
  });
}

export function useSetEmployeeSkills(cid: string, eid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof SetEmployeeSkillsInput>) => put<unknown>(`${c(cid)}/employees/${eid}/skills`, body),
    onSuccess: () => inv(qk.employee(cid, eid)),
  });
}

export function useEvidence(cid: string | null | undefined, eid: string) {
  return useQuery({
    queryKey: qk.evidence(cid ?? "", eid),
    queryFn: () => api.get<Paginated<CareerEvidence> | CareerEvidence[]>(`${c(cid!)}/employees/${eid}/evidence${qs({ limit: 100 })}`),
    select: items,
    enabled: !!cid && !!eid,
  });
}

export function useOverrideRank(cid: string, eid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof OverrideRankInput>) => api.post<unknown>(`${c(cid)}/employees/${eid}/rank`, body),
    onSuccess: () => inv(qk.employee(cid, eid), ["company", cid, "employees"]),
  });
}

export function useEmployeeTasks(cid: string | null | undefined, eid: string) {
  return useCursorList<TaskListItem>(
    qk.employeeTasks(cid ?? "", eid),
    (cursor) => `${c(cid!)}/employees/${eid}/tasks${qs({ limit: 100, cursor })}`,
    !!cid && !!eid,
  );
}

// ---------------------------------------------------------------------------
// Skills / projects
// ---------------------------------------------------------------------------

export function useSkills(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.skills(cid ?? ""),
    queryFn: () => api.get<Paginated<Skill> | Skill[]>(`${c(cid!)}/skills${qs({ limit: 100 })}`),
    select: items,
    enabled: !!cid,
  });
}

export function useProjects(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.projects(cid ?? ""),
    queryFn: () => api.get<Paginated<Project> | Project[]>(`${c(cid!)}/projects${qs({ limit: 100 })}`),
    select: items,
    enabled: !!cid,
  });
}

export function useCreateProject(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateProjectInput>) => api.post<Project>(`${c(cid)}/projects`, body),
    onSuccess: () => inv(qk.projects(cid)),
  });
}

// ---------------------------------------------------------------------------
// Tasks / approvals
// ---------------------------------------------------------------------------

export function useTasks(cid: string | null | undefined, filters: { status?: string; assigneeId?: string; projectId?: string } = {}) {
  return useCursorList<TaskListItem>(
    qk.tasks(cid ?? "", filters),
    (cursor) => `${c(cid!)}/tasks${qs({ ...filters, limit: 100, cursor })}`,
    !!cid,
  );
}

export function useTask(cid: string | null | undefined, tid: string) {
  return useQuery({
    queryKey: qk.task(cid ?? "", tid),
    queryFn: () => api.get<TaskDetail>(`${c(cid!)}/tasks/${tid}`),
    enabled: !!cid && !!tid,
  });
}

const EVENTS_PAGE = 500;
/** Safety cap on pages per fetch (EVENTS_PAGE x this many events). */
const EVENTS_MAX_PAGES = 40;

/**
 * Every event of one task, oldest first. The endpoint pages oldest-first by `seq`, so the
 * newest events (task.completed, errors) are on the last page: follow `after=<last seq>`
 * until a page comes back short. A refetch (SSE invalidation) reloads the full timeline.
 */
export function useTaskEvents(cid: string | null | undefined, tid: string) {
  return useQuery({
    queryKey: qk.taskEvents(cid ?? "", tid),
    queryFn: async ({ signal }) => {
      const all: TaskTimelineEvent[] = [];
      let after = 0;
      for (let i = 0; i < EVENTS_MAX_PAGES; i++) {
        const page = items(
          await api.get<Paginated<TaskTimelineEvent> | TaskTimelineEvent[]>(
            `${c(cid!)}/tasks/${tid}/events${qs({ after, limit: EVENTS_PAGE })}`,
            undefined,
            { signal },
          ),
        );
        all.push(...page);
        if (page.length < EVENTS_PAGE) break;
        const last = Number(page[page.length - 1]!.seq);
        if (!Number.isFinite(last) || last <= after) break;
        after = last;
      }
      return all;
    },
    enabled: !!cid && !!tid,
  });
}

export function useCreateTask(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateTaskInput>) => api.post<TaskListItem>(`${c(cid)}/tasks`, body),
    onSuccess: () => inv(["company", cid, "tasks"]),
  });
}

export function useTaskAction(cid: string, tid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof TaskActionInput>) => api.post<unknown>(`${c(cid)}/tasks/${tid}/actions`, body),
    onSuccess: () => inv(["company", cid, "tasks"], ["company", cid, "approvals"]),
  });
}

export function useApprovals(cid: string | null | undefined, status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | undefined = "PENDING") {
  return useQuery({
    queryKey: qk.approvals(cid ?? "", status),
    queryFn: () =>
      api.get<Paginated<ApprovalRequest> | ApprovalRequest[]>(`${c(cid!)}/approvals${qs({ status, limit: 100 })}`),
    select: items,
    enabled: !!cid,
  });
}

/**
 * Approve or deny an ApprovalRequest. The result toasts live here, in the mutation options, not in
 * per-call `mutate(..., { onSuccess })` callbacks: TanStack Query skips per-call callbacks when the
 * caller has unmounted, and the approval strip unmounts as soon as the task moves on, which can
 * happen before the response arrives. `title` is display-only and is not sent.
 */
export function useDecideApproval(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, decision, note }: In<typeof DecideApprovalInput> & { id: string; title?: string }) =>
      api.post<unknown>(`${c(cid)}/approvals/${id}`, { decision, note }),
    onSuccess: (_data, { decision, title }) => {
      toast.success(decision === "APPROVED" ? "Approved" : "Denied", { description: title });
      return inv(["company", cid, "approvals"], ["company", cid, "tasks"]);
    },
    onError: (err) => {
      toast.error("The decision was not saved", { description: errorMessage(err) });
    },
  });
}

/** Artifact download/view URL (file artifacts stream from this route). */
export function artifactUrl(cid: string, aid: string) {
  return `${c(cid)}/artifacts/${aid}`;
}

// ---------------------------------------------------------------------------
// Providers / runners / usage
// ---------------------------------------------------------------------------

export function useProviders(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.providers(cid ?? ""),
    queryFn: () =>
      api.get<Paginated<ProviderConnectionView> | ProviderConnectionView[]>(`${c(cid!)}/providers${qs({ limit: 100 })}`),
    select: items,
    enabled: !!cid,
  });
}

export function useCreateProvider(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateProviderConnectionInput>) => api.post<ProviderConnectionView>(`${c(cid)}/providers`, body),
    onSuccess: () => inv(qk.providers(cid)),
  });
}

export function useUpdateProvider(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: In<typeof UpdateProviderConnectionInput> & { id: string }) =>
      api.patch<ProviderConnectionView>(`${c(cid)}/providers/${id}`, body),
    onSuccess: () => inv(qk.providers(cid)),
  });
}

export function useRevokeProvider(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del<unknown>(`${c(cid)}/providers/${id}`),
    onSuccess: () => inv(qk.providers(cid)),
  });
}

export function useVerifyProvider(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<VerifyResult>(`${c(cid)}/providers/${id}/verify`, {}),
    onSuccess: () => inv(qk.providers(cid)),
  });
}

/** Subscription-first status per provider. Polled every 15 s; SSE `provider.*` / `runner.*` events refetch sooner. */
export function useProviderStatus(cid: string | null | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.providerStatus(cid ?? ""),
    queryFn: () => api.get<ProviderStatusView[] | Paginated<ProviderStatusView>>(`${c(cid!)}/providers/status`),
    select: items,
    enabled: !!cid && opts.enabled !== false,
    refetchInterval: 15_000,
  });
}

export function useReconnectProvider(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<ReconnectProviderResponse>(`${c(cid)}/providers/${id}/reconnect`, {}),
    onSuccess: () => inv(qk.providers(cid), ["company", cid, "tasks"]),
  });
}

export function useRunners(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.runners(cid ?? ""),
    queryFn: () => api.get<Paginated<RunnerView> | RunnerView[]>(`${c(cid!)}/runners${qs({ limit: 100 })}`),
    select: items,
    enabled: !!cid,
    refetchInterval: 30_000,
  });
}

export function useCreateRunner(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateRunnerInput>) => api.post<CreatedRunner>(`${c(cid)}/runners`, body),
    onSuccess: () => inv(qk.runners(cid)),
  });
}

export function useRevokeRunner(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del<unknown>(`${c(cid)}/runners/${id}`),
    onSuccess: () => inv(qk.runners(cid)),
  });
}

export function useUsage(cid: string | null | undefined, range: { from?: string; to?: string; employeeId?: string } = {}) {
  return useQuery({
    queryKey: qk.usage(cid ?? "", range),
    queryFn: () => api.get<UsageSummary>(`${c(cid!)}/usage${qs(range)}`),
    enabled: !!cid,
  });
}

// ---------------------------------------------------------------------------
// Learning / knowledge / memory
// ---------------------------------------------------------------------------

export function useLearningSchedules(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.schedules(cid ?? ""),
    queryFn: () =>
      api.get<Paginated<LearningScheduleView> | LearningScheduleView[]>(`${c(cid!)}/learning/schedules`),
    select: items,
    enabled: !!cid,
  });
}

export function useUpsertSchedule(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof UpsertLearningScheduleInput>) => put<LearningScheduleView>(`${c(cid)}/learning/schedules`, body),
    onSuccess: () => inv(qk.schedules(cid), ["company", cid, "employees", "detail"]),
  });
}

export function useRunScheduleNow(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ scheduleId, employeeId }: { scheduleId: string; employeeId?: string }) =>
      api.post<unknown>(`${c(cid)}/learning/schedules/${scheduleId}/run-now`, employeeId ? { employeeId } : {}),
    onSuccess: () => inv(["company", cid, "learning"]),
  });
}

export function useLearningSources(cid: string | null | undefined) {
  return useQuery({
    queryKey: qk.sources(cid ?? ""),
    queryFn: () =>
      api.get<Paginated<LearningSourceView> | LearningSourceView[]>(`${c(cid!)}/learning/sources${qs({ limit: 100 })}`),
    select: items,
    enabled: !!cid,
  });
}

export function useCreateSource(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateLearningSourceInput>) => api.post<LearningSourceView>(`${c(cid)}/learning/sources`, body),
    onSuccess: () => inv(qk.sources(cid), ["company", cid, "employees", "detail"]),
  });
}

export function useDeleteSource(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del<unknown>(`${c(cid)}/learning/sources/${id}`),
    onSuccess: () => inv(qk.sources(cid), ["company", cid, "employees", "detail"]),
  });
}

export function useLearningRuns(cid: string | null | undefined, employeeId?: string) {
  return useQuery({
    queryKey: qk.runs(cid ?? "", employeeId),
    queryFn: () =>
      api.get<Paginated<LearningRunView> | LearningRunView[]>(`${c(cid!)}/learning/runs${qs({ employeeId, limit: 50 })}`),
    select: items,
    enabled: !!cid,
  });
}

export function useCancelRun(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (rid: string) => api.post<unknown>(`${c(cid)}/learning/runs/${rid}/cancel`, {}),
    onSuccess: () => inv(["company", cid, "learning"]),
  });
}

export function useKnowledge(
  cid: string | null | undefined,
  filters: { status?: string; employeeId?: string; kind?: string } = {},
) {
  return useCursorList<KnowledgeEntryView>(
    qk.knowledge(cid ?? "", filters),
    (cursor) => `${c(cid!)}/knowledge${qs({ ...filters, limit: 100, cursor })}`,
    !!cid,
  );
}

export function useCreateKnowledge(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (body: In<typeof CreateKnowledgeInput>) => api.post<KnowledgeEntryView>(`${c(cid)}/knowledge`, body),
    onSuccess: () => inv(["company", cid, "knowledge"]),
  });
}

export function useDecideKnowledge(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: In<typeof DecideKnowledgeInput> & { id: string }) =>
      api.post<unknown>(`${c(cid)}/knowledge/${id}/decide`, body),
    onSuccess: () => inv(["company", cid, "knowledge"]),
  });
}

export function useDeleteKnowledge(cid: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del<unknown>(`${c(cid)}/knowledge/${id}`),
    onSuccess: () => inv(["company", cid, "knowledge"]),
  });
}

export function useMemorySearch(
  cid: string | null | undefined,
  params: { q: string; employeeId?: string; projectId?: string; limit?: number } | null,
) {
  return useQuery({
    queryKey: qk.memorySearch(cid ?? "", params ?? {}),
    queryFn: () =>
      api.get<Paginated<MemoryHit> | MemoryHit[]>(`${c(cid!)}/memory/search${qs({ ...params! })}`),
    select: items,
    enabled: !!cid && !!params?.q,
  });
}
