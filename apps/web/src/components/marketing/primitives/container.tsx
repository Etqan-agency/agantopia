import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/utils";

/**
 * Centred content column: max width 1200px, side padding 16 / 24 / 40px.
 *
 * @example
 * <Container>...</Container>
 * <Container as="nav" className="flex items-center">...</Container>
 */
export function Container({
  as: Tag = "div",
  className,
  ...props
}: ComponentProps<"div"> & { as?: ElementType }) {
  return <Tag className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-10", className)} {...props} />;
}
