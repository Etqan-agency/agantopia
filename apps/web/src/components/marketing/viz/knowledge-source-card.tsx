import { BookOpen, ClipboardCheck, GitBranch } from "lucide-react";
import { Pill } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";
import type { KnowledgeSource, KnowledgeSourceKind } from "./sample-data";
import { SURFACE, type Surface } from "./surface";

const KIND: Record<KnowledgeSourceKind, { label: string; Icon: typeof BookOpen }> = {
  docs: { label: "Documentation", Icon: BookOpen },
  github: { label: "GitHub repository", Icon: GitBranch },
  postmortem: { label: "Task postmortem", Icon: ClipboardCheck },
};

/**
 * One learning source: allowlisted docs (with URL), a GitHub repository, or a task postmortem,
 * with what was found on the last run. The location is shown as text, not a link.
 *
 * @example
 * <KnowledgeSourceCard source={{ kind: "docs", title: "React reference", location: "https://react.dev/reference/react",
 *   detail: "Allowlisted official docs", state: "Unchanged, skipped" }} />
 */
export function KnowledgeSourceCard({
  source,
  surface = "dark",
  className,
}: {
  source: KnowledgeSource;
  surface?: Surface;
  className?: string;
}) {
  const s = SURFACE[surface];
  const { label, Icon } = KIND[source.kind];
  return (
    <article aria-label={`${label}: ${source.title}`} className={cn("flex min-w-0 flex-col gap-1.5 rounded-md border p-3.5", s.inset, className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Icon aria-hidden className={cn("size-4 shrink-0", s.icon)} />
        <span className={cn("text-xs font-medium", s.muted)}>{label}</span>
        <Pill variant={source.kind === "postmortem" ? "violet" : "neutral"} className="ml-auto max-w-full whitespace-normal">
          {source.state}
        </Pill>
      </div>
      <h4 className="text-sm font-semibold">{source.title}</h4>
      <p className={cn("font-mono text-xs break-all", s.accent)}>{source.location}</p>
      <p className={cn("text-xs leading-relaxed", s.muted)}>{source.detail}</p>
    </article>
  );
}
