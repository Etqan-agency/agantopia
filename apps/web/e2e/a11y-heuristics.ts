import type { Page } from "@playwright/test";

/**
 * A small axe-like check run in the page: every visible interactive control
 * must have an accessible name, every form field must be labelled.
 * Returns human-readable offenders (empty array = pass).
 */
export async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const h = el as HTMLElement;
      if (h.closest("[aria-hidden='true'], [inert]")) return false;
      const r = h.getBoundingClientRect();
      const cs = getComputedStyle(h);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const textOf = (el: Element | null): string => (el ? ((el as HTMLElement).innerText ?? el.textContent ?? "").trim() : "");
    const nameOf = (el: Element): string => {
      const label = el.getAttribute("aria-label");
      if (label && label.trim()) return label.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const t = by
          .split(/\s+/)
          .map((id) => textOf(document.getElementById(id)))
          .join(" ")
          .trim();
        if (t) return t;
      }
      const id = el.getAttribute("id");
      if (id) {
        const l = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (textOf(l)) return textOf(l);
      }
      const wrap = el.closest("label");
      if (wrap && textOf(wrap)) return textOf(wrap);
      const tag = el.tagName.toLowerCase();
      if (!["input", "textarea", "select"].includes(tag)) {
        const t = textOf(el);
        if (t) return t;
        const img = el.querySelector("img[alt], svg[aria-label], [role='img'][aria-label]");
        if (img) return img.getAttribute("alt") || img.getAttribute("aria-label") || "";
      }
      return (el.getAttribute("title") ?? "").trim();
    };
    const sel = [
      "button",
      "a[href]",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "[role='button']",
      "[role='link']",
      "[role='switch']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='combobox']",
      "[role='tab']",
      "[role='menuitem']",
      "[role='slider']",
    ].join(",");
    const out: string[] = [];
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      if (!nameOf(el)) {
        const h = el as HTMLElement;
        out.push(`${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}${el.getAttribute("type") ? `[type=${el.getAttribute("type")}]` : ""} ${h.outerHTML.slice(0, 160)}`);
      }
    }
    return out;
  });
}

export async function noHorizontalPageScroll(page: Page) {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
}
