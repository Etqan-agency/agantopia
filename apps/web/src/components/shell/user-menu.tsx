"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { AvatarSwatch } from "@/components/avatar-swatch";
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
import { toast } from "@/components/ui/toaster";
import { useCompany } from "@/hooks/use-company";
import { cn, errorMessage } from "@/lib/utils";

type Theme = "system" | "light" | "dark";
const THEME_KEY = "agentopia.theme";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const themeListeners = new Set<() => void>();

function applyTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  themeListeners.forEach((l) => l());
}

function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    readTheme,
    () => "system",
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { me } = useCompany();
  const router = useRouter();
  const qc = useQueryClient();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const name = me?.user.name || me?.user.email || "Account";

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      qc.clear();
      router.replace("/login");
    } catch (err) {
      toast.error("Sign out failed", { description: errorMessage(err) });
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-chrome-fg hover:bg-chrome-raised",
          compact && "w-auto px-2",
        )}
      >
        <AvatarSwatch name={name} palette="sky" size="sm" />
        {/* The name comes from text content, not aria-label, so the visible name and email are
            part of it (WCAG 2.5.3 label in name). Compact shows only the avatar. */}
        <span className="sr-only">{compact ? `Account menu for ${name}` : "Account menu for "}</span>
        {compact ? null : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm">{me?.user.name || "Account"}</span>
            {me?.user.email ? <span className="truncate text-xs text-chrome-muted">{me.user.email}</span> : null}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-60">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => applyTheme(v as Theme)}>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden /> Match system
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void signOut(); }} disabled={signingOut}>
          <LogOut aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
