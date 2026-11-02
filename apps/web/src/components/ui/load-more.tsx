"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Load more" for a cursor-paginated list (see useCursorList). Renders nothing when there is no next page. */
export function LoadMore({
  query,
  shown,
  noun,
  className,
}: {
  query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown };
  shown: number;
  noun: string;
  className?: string;
}) {
  if (!query.hasNextPage) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-sm text-fg-muted", className)}>
      <span>
        Showing the newest {shown} {noun}. Older ones are not loaded yet.
      </span>
      <Button variant="secondary" size="sm" pending={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
        Load more
      </Button>
    </div>
  );
}
