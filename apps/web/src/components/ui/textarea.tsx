import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldBase } from "./input";

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(fieldBase, "min-h-20 py-2.5 leading-relaxed", className)} {...props} />;
}
