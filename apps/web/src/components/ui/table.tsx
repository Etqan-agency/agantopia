import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Plain, rule-separated table. Pair with a list rendering below 900px
 * (`hidden min-[900px]:block` on the table, the inverse on the list).
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-rule-strong", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&>tr]:border-b [&>tr]:border-rule [&>tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-fg-muted first:pl-0 last:pr-0", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-3 align-middle first:pl-0 last:pr-0", className)} {...props} />;
}
