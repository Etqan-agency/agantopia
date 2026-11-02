/** Minimal robots.txt support with a per-origin in-memory cache. */
import { log } from "../deps";
import { LEARNING_USER_AGENT, readCapped, type FetchImpl } from "./types";

export type RobotsRule = { allow: boolean; path: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

/** Parse robots.txt into user-agent groups (Allow/Disallow only). */
export function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "allow" || key === "disallow") {
        if (key === "disallow" && value === "") continue; // empty disallow = allow all
        current.rules.push({ allow: key === "allow", path: value });
      }
    }
  }
  return groups;
}

function ruleRegex(path: string): RegExp {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * Decide whether `pathWithQuery` is allowed for `userAgent` (Google-style:
 * most specific group, longest matching rule wins, Allow wins ties).
 */
export function isPathAllowed(groups: RobotsGroup[], userAgent: string, pathWithQuery: string): boolean {
  const token = userAgent.split("/")[0]!.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  let best: RobotsRule | null = null;
  for (const r of rules) {
    if (!ruleRegex(r.path).test(pathWithQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

type CacheEntry = { groups: RobotsGroup[]; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

/** Clear the robots.txt cache (tests). */
export function clearRobotsCache(): void {
  cache.clear();
}

/**
 * Check robots.txt for `url`. Fetches `<origin>/robots.txt` with a 5 s timeout
 * and caches it for an hour. 4xx → everything allowed. Network errors / 5xx →
 * assumed allowed (logged), per the learning engine policy.
 */
export async function isAllowedByRobots(
  url: string,
  userAgent: string = LEARNING_USER_AGENT,
  opts: { fetchImpl?: FetchImpl; signal?: AbortSignal; now?: number } = {},
): Promise<boolean> {
  const u = new URL(url);
  const now = opts.now ?? Date.now();
  let entry = cache.get(u.origin);
  if (!entry || entry.expires < now) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    let groups: RobotsGroup[] = [];
    try {
      const signals = [AbortSignal.timeout(5000), ...(opts.signal ? [opts.signal] : [])];
      const res = await fetchImpl(`${u.origin}/robots.txt`, {
        headers: { "User-Agent": userAgent, Accept: "text/plain" },
        signal: AbortSignal.any(signals),
        redirect: "follow",
      });
      if (res.ok) groups = parseRobots((await readCapped(res, 64 * 1024)).text);
      else if (res.status >= 500) log.warn({ origin: u.origin, status: res.status }, "robots.txt server error; assuming allowed");
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      log.warn({ origin: u.origin, err: String(err) }, "robots.txt fetch failed; assuming allowed");
    }
    entry = { groups, expires: now + TTL_MS };
    cache.set(u.origin, entry);
  }
  return isPathAllowed(entry.groups, userAgent, `${u.pathname}${u.search}`);
}
