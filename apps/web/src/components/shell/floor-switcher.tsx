"use client";

import { ChevronDown, Plus, Settings } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany, type FloorOption } from "@/hooks/use-company";
import { cn } from "@/lib/utils";

function groupByBuilding(floors: FloorOption[]) {
  const map = new Map<string, { name: string; floors: FloorOption[] }>();
  for (const f of floors) {
    const g = map.get(f.buildingId) ?? { name: f.buildingName, floors: [] };
    g.floors.push(f);
    map.set(f.buildingId, g);
  }
  return [...map.entries()];
}

/** Company/floor switcher at the top of the rail. The company name is set in Fraunces. */
export function FloorSwitcher({ compact = false }: { compact?: boolean }) {
  const { floors, currentFloor, companyName, setFloor, isLoading } = useCompany();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2">
        <Skeleton className="h-5 w-32 bg-chrome-raised" />
        <Skeleton className="h-3.5 w-20 bg-chrome-raised" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-chrome-fg hover:bg-chrome-raised",
          compact && "max-w-[60vw] py-1.5",
        )}
      >
        {/* Accessible name = this prefix + the visible text (WCAG 2.5.3 label in name). */}
        <span className="sr-only">Switch floor. Current: </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate font-display font-semibold tracking-tight", compact ? "text-base" : "text-lg leading-6")}>
            {companyName ?? "No company yet"}
          </span>
          <span className="truncate text-xs text-chrome-muted">
            {currentFloor ? `${currentFloor.name}, ${currentFloor.buildingName}` : "Create a company to get a floor"}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-chrome-muted transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={currentFloor?.id} onValueChange={setFloor}>
          {groupByBuilding(floors).map(([buildingId, group], i) => (
            <div key={buildingId}>
              {i > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
              {group.floors.map((f) => (
                <DropdownMenuRadioItem key={f.id} value={f.id} disabled={!f.companyId}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{f.companyName ?? "Empty floor"}</span>
                    <span className="truncate text-xs text-fg-muted">{f.name}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?step=company">
            <Plus aria-hidden />
            New company
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings#building">
            <Settings aria-hidden />
            Manage floors
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
