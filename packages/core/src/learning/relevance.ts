/**
 * Deterministic relevance scoring (no LLM): how well a document matches an
 * employee's allowlisted topics. Score in [0, 1]; `isRelevant` uses 0.15.
 */

export const RELEVANCE_THRESHOLD = 0.15;

const STOPWORDS = new Set(["the", "and", "for", "with", "of", "a", "an", "to", "in", "on", "web", "design", "testing"]);

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKC");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(`(?<![a-z0-9])${escapeRe(needle)}(?![a-z0-9])`, "g");
  return haystack.match(re)?.length ?? 0;
}

/**
 * Score = 0.7 × topic coverage + 0.3 × topic-term density.
 * Coverage: share of topics found (a multi-word topic not found verbatim gets
 * partial credit for its distinctive words). Density: topic hits per 1,000
 * words, saturating at 10. Specialization topics count double in coverage.
 */
export function scoreRelevance(text: string, topics: string[], specializationTopics: string[] = []): number {
  const hay = norm(text);
  const words = hay.split(/[^a-z0-9]+/).filter(Boolean).length;
  if (words === 0) return 0;
  const weighted = new Map<string, number>();
  for (const t of topics) if (t.trim()) weighted.set(norm(t.trim()), 1);
  for (const t of specializationTopics) if (t.trim()) weighted.set(norm(t.trim()), 2);
  if (weighted.size === 0) return 0;

  let covered = 0;
  let totalWeight = 0;
  let hits = 0;
  for (const [topic, w] of weighted) {
    totalWeight += w;
    const n = countOccurrences(hay, topic);
    if (n > 0) {
      covered += w;
      hits += n;
      continue;
    }
    const parts = topic.split(/[\s/]+/).filter((p) => p.length > 1 && !STOPWORDS.has(p));
    if (parts.length > 1) {
      const found = parts.filter((p) => countOccurrences(hay, p) > 0).length;
      covered += w * 0.5 * (found / parts.length);
    }
  }
  const coverage = covered / totalWeight;
  const density = Math.min(1, ((hits / words) * 1000) / 10);
  return Math.max(0, Math.min(1, 0.7 * coverage + 0.3 * density));
}

/** True when the score passes the relevance threshold (0.15). */
export function isRelevant(score: number): boolean {
  return score >= RELEVANCE_THRESHOLD;
}
