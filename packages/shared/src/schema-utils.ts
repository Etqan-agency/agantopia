import { z } from "zod";

type UnwrapDefault<S> = S extends z.ZodDefault<infer Inner> ? Inner : S extends z.ZodPrefault<infer Inner> ? Inner : S;
export type PatchShape<T extends z.ZodRawShape> = { [K in keyof T]: z.ZodOptional<UnwrapDefault<T[K]>> };

function unwrapDefault(s: z.ZodType): z.ZodType {
  let cur: z.ZodType = s;
  while (cur instanceof z.ZodDefault || cur instanceof z.ZodPrefault) cur = cur.unwrap() as z.ZodType;
  return cur;
}

/**
 * A true PATCH schema for an object: every field optional, field validations
 * kept, and `.default()` values removed. zod 4 `.partial()` still fills in
 * defaults for absent keys, which would reset stored values on a partial update.
 */
export function patchSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<PatchShape<T>> {
  const shape: Record<string, z.ZodType> = {};
  for (const [k, v] of Object.entries(schema.shape)) shape[k] = unwrapDefault(v as z.ZodType).optional();
  return z.object(shape) as unknown as z.ZodObject<PatchShape<T>>;
}

/** True when `tz` is an IANA time zone name the runtime understands. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** An IANA time zone name, e.g. "Africa/Cairo". Rejected before it can reach SQL `AT TIME ZONE` or the scheduler. */
export const TimeZone = z.string().min(1).max(64).refine(isValidTimeZone, "Unknown IANA time zone");
