/**
 * Deterministic HTML/Markdown → text extraction (no external deps, no LLM).
 * Removes script/style/nav/footer and other non-content blocks, keeps headings
 * (as `#` lines), paragraphs, list items and code blocks.
 */

export type Extracted = { title: string | null; text: string; headings: string[] };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Decode the common named and all numeric HTML entities. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m;
  });
}

const DROP_BLOCKS = ["script", "style", "noscript", "nav", "footer", "svg", "template", "iframe", "form", "button", "canvas", "object"];

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function inlineText(s: string): string {
  return decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();
}

/** Extract title, readable text and headings from an HTML document. */
export function extractHtml(html: string): Extracted {
  let s = html.replace(/<!--[\s\S]*?-->/g, " ");
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(s);
  const title = titleMatch ? inlineText(titleMatch[1] ?? "") || null : null;
  s = s.replace(/<head[\s\S]*?<\/head>/i, " ");
  for (const tag of DROP_BLOCKS) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"), " ");
    s = s.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), " ");
  }
  // Prefer <main>/<article> when present.
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(s) ?? /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(s);
  if (main?.[1] && inlineText(main[1]).length > 200) s = main[1];

  const codeBlocks: string[] = [];
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, inner: string) => {
    const code = decodeEntities(stripTags(inner.replace(/<br\s*\/?>/gi, "\n"))).replace(/^\n+|\s+$/g, "");
    codeBlocks.push(code);
    return `\n\n\u0000CODE${codeBlocks.length - 1}\u0000\n\n`;
  });

  const headings: string[] = [];
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) => {
    const t = inlineText(inner);
    if (!t) return "\n";
    headings.push(t);
    return `\n\n${"#".repeat(Number(lvl))} ${t}\n\n`;
  });
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner: string) => `\`${inlineText(inner)}\``);
  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|section|article|ul|ol|table|tr|blockquote|dl|dd|dt|main)>/gi, "\n\n");
  s = s.replace(/<(p|div|section|tr|blockquote|dd|dt)\b[^>]*>/gi, "\n");
  s = s.replace(/<\/t[dh]>/gi, " | ");
  s = decodeEntities(stripTags(s));

  const lines = s
    .split("\n")
    .map((l) => l.replace(/[ \t\f\v\r]+/g, " ").trim())
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""));
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => "```\n" + (codeBlocks[Number(i)] ?? "") + "\n```");
  return { title, text, headings };
}

/** Extract from Markdown/plain text: drop inline HTML and images, keep the rest. */
export function extractMarkdown(md: string): Extracted {
  const text = md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
  return { title: headings[0] ?? null, text: decodeEntities(text), headings };
}

/** Pick an extractor from the content type (falls back to sniffing for HTML). */
export function extractText(body: string, contentType = ""): Extracted {
  const ct = contentType.toLowerCase();
  if (ct.includes("html") || (!ct && /<html|<body|<p[\s>]/i.test(body))) return extractHtml(body);
  return extractMarkdown(body);
}
