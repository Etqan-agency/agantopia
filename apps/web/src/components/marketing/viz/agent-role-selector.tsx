"use client";

import { Tabs } from "radix-ui";
import { cn } from "@/lib/utils";
import { AgentProfileCard } from "./agent-profile-card";
import { AvatarDisc } from "./avatar-tone";
import { SAMPLE_PROFILES, type AgentProfile } from "./sample-data";
import { SURFACE, type Surface } from "./surface";

/**
 * Role switcher for the workforce section: a radix Tabs list (roving focus, arrow keys,
 * Home/End) across the example roles, with an AgentProfileCard per role. Defaults to one
 * sample profile per role in HOME.workforce.
 *
 * @example
 * <AgentRoleSelector />
 * <AgentRoleSelector surface="raised" defaultRoleId="designer" label="Example employees" />
 */
export function AgentRoleSelector({
  profiles = SAMPLE_PROFILES,
  defaultRoleId,
  label = "Example roles",
  surface = "dark",
  illustrative = true,
  className,
}: {
  profiles?: AgentProfile[];
  defaultRoleId?: string;
  /** Accessible name of the tab list. */
  label?: string;
  surface?: Surface;
  illustrative?: boolean;
  className?: string;
}) {
  const s = SURFACE[surface];
  return (
    <Tabs.Root defaultValue={defaultRoleId ?? profiles[0]?.roleId} className={cn("flex flex-col gap-4", className)}>
      <Tabs.List aria-label={label} className="flex flex-wrap gap-2">
        {profiles.map((p) => (
          <Tabs.Trigger
            key={p.roleId}
            value={p.roleId}
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-4 pl-1.5 text-sm font-medium transition-colors duration-[160ms]",
              s.focus,
              // Active role: gold pill with navy text.
              "border-snow/15 text-mist hover:border-gold/50 hover:text-snow data-[state=active]:border-gold data-[state=active]:bg-gold data-[state=active]:text-navy",
            )}
          >
            <AvatarDisc name={p.name} tone={p.tone} size="sm" />
            {p.role}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {profiles.map((p) => (
        <Tabs.Content key={p.roleId} value={p.roleId} className={cn("rounded-lg", s.focus)}>
          <AgentProfileCard profile={p} surface={surface} illustrative={illustrative} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
