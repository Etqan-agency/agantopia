"use client";

import { DropdownMenu as Menu } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuGroup = Menu.Group;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-52 overflow-hidden rounded-md border border-rule-strong bg-surface-raised p-1 text-fg shadow-[0_12px_32px_-16px_rgb(0_0_0/0.35)] data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}

const itemClass =
  "relative flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-sunken [&_svg]:size-4 [&_svg]:text-fg-muted";

export function DropdownMenuItem({ className, tone, ...props }: ComponentProps<typeof Menu.Item> & { tone?: "danger" }) {
  return <Menu.Item className={cn(itemClass, tone === "danger" && "text-brick-ink [&_svg]:text-brick-ink", className)} {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem className={cn(itemClass, "pl-8", className)} {...props}>
      <Menu.ItemIndicator className="absolute left-3 inline-flex">
        <span className="size-2 rounded-full bg-violet" aria-hidden />
      </Menu.ItemIndicator>
      {children}
    </Menu.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn("px-3 pt-2 pb-1 text-xs font-medium text-fg-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn("my-1 h-px bg-rule", className)} {...props} />;
}
