"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmployeeHeader } from "@/components/employees/employee-header";
import { KnowledgeTab } from "@/components/employees/tab-knowledge";
import { LearningTab } from "@/components/employees/tab-learning";
import { OverviewTab } from "@/components/employees/tab-overview";
import { ProgressionTab } from "@/components/employees/tab-progression";
import { PromptTab } from "@/components/employees/tab-prompt";
import { SkillsTab } from "@/components/employees/tab-skills";
import { TasksTab } from "@/components/employees/tab-tasks";
import { UsageTab } from "@/components/employees/tab-usage";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployee } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "prompt", label: "Prompt" },
  { value: "skills", label: "Skills" },
  { value: "knowledge", label: "Knowledge" },
  { value: "tasks", label: "Projects and tasks" },
  { value: "progression", label: "Progression" },
  { value: "learning", label: "Learning" },
  { value: "usage", label: "Usage" },
] as const;

export default function EmployeePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { companyId } = useCompany();
  const employee = useEmployee(companyId, id);

  if (!companyId || employee.isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <div className="flex items-center gap-4 border-b border-rule pb-6">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <SkeletonRows rows={5} label="Loading employee" />
      </div>
    );
  }

  if (employee.isError) {
    const status = (employee.error as { status?: number } | null)?.status;
    if (status === 404)
      return (
        <EmptyState
          title="This employee is not on this floor"
          description="They may have been archived, or they belong to a different company. Switch floors from the rail, or go back to the roster."
          action={
            <Link href="/employees" className="text-sm text-sky-ink hover:underline">
              Back to employees
            </Link>
          }
        />
      );
    return <ErrorState title="This employee could not be loaded" error={employee.error} onRetry={() => employee.refetch()} />;
  }

  const e = employee.data!;
  return (
    <div className="flex flex-col gap-6">
      <EmployeeHeader companyId={companyId} employee={e} />
      <Tabs defaultValue="overview">
        <TabsList aria-label={`${e.name} sections`}>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="prompt">
          <PromptTab companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="skills">
          <SkillsTab key={e.skills.map((s) => `${s.skillId}:${s.proficiency}`).join(",")} companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="progression">
          <ProgressionTab companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="learning">
          <LearningTab companyId={companyId} employee={e} />
        </TabsContent>
        <TabsContent value="usage">
          <UsageTab employee={e} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
