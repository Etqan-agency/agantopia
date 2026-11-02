type AnyModule = Record<string, unknown>;
const cache = new Map<string, AnyModule | null>();

/**
 * Imports an optional sibling module owned by another slice (memory,
 * learning) without a static dependency, so core compiles before it exists.
 * Specifiers are relative to this directory (packages/core/src/orchestration).
 * Returns null when the module cannot be loaded.
 */
export async function optionalImport(base: string): Promise<AnyModule | null> {
  if (cache.has(base)) return cache.get(base) ?? null;
  for (const spec of [base, `${base}.ts`, `${base}.js`]) {
    try {
      const mod = (await import(/* @vite-ignore */ /* webpackIgnore: true */ spec)) as AnyModule;
      cache.set(base, mod);
      return mod;
    } catch {
      // try next specifier
    }
  }
  cache.set(base, null);
  return null;
}
