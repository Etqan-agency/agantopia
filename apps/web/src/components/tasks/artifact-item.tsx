"use client";

import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SimulatedTag } from "@/components/mode-badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArtifactView, TaskDetail } from "@/hooks/api-shapes";
import { artifactUrl } from "@/hooks/use-api";
import { api } from "@/lib/api-client";

type ArtifactSummary = TaskDetail["artifacts"][number];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const KIND_LABEL: Record<string, string> = { TEXT: "Text", FILE: "File", DIFF: "Diff", LINK: "Link", LOG: "Log" };

/** One artifact row. Text content is fetched only when the person opens it. */
export function ArtifactItem({ companyId, artifact, simulated = false }: { companyId: string; artifact: ArtifactSummary; simulated?: boolean }) {
  const [open, setOpen] = useState(false);
  const url = artifactUrl(companyId, artifact.id);
  const inline = artifact.hasContent && artifact.kind !== "FILE";
  const content = useQuery({
    queryKey: ["company", companyId, "artifacts", artifact.id],
    queryFn: () => api.get<ArtifactView>(url),
    enabled: open && inline,
    staleTime: Infinity,
  });
  const panelId = `artifact-${artifact.id}`;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FileText className="size-4 text-fg-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{artifact.name}</span>
        {simulated ? <SimulatedTag /> : null}
        <span className="text-xs text-fg-muted">
          {KIND_LABEL[artifact.kind] ?? artifact.kind}, {formatBytes(artifact.sizeBytes)}
        </span>
        {inline ? (
          <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId}>
            {open ? "Hide" : "Show"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" asChild>
            <a href={url} download={artifact.name}>
              <Download aria-hidden />
              Download
            </a>
          </Button>
        )}
      </div>
      {open && inline ? (
        <div id={panelId}>
          {content.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : content.error ? (
            <ErrorState title="This artifact could not be loaded" error={content.error} onRetry={() => void content.refetch()} />
          ) : artifact.kind === "LINK" && content.data?.content ? (
            <a href={content.data.content} className="text-sm break-all text-sky-ink underline-offset-4 hover:underline" rel="noreferrer noopener" target="_blank">
              {content.data.content}
            </a>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-md border border-rule bg-surface-sunken p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {content.data?.content ?? "No text content."}
            </pre>
          )}
        </div>
      ) : null}
    </li>
  );
}
