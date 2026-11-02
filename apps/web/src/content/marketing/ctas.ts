import { AUTH_LINKS } from "./routes";
import type { Cta, CtaPair } from "./types";

export const CTA_CREATE_COMPANY: Cta = { label: "Create your company", href: AUTH_LINKS.signUp, dataCta: "create-company" };
export const CTA_WATCH_DEMO: Cta = { label: "Watch the office work", href: "/demo", dataCta: "watch-demo" };
export const CTA_SIGN_IN: Cta = { label: "Sign in", href: AUTH_LINKS.signIn, dataCta: "sign-in" };

/** Default closing pair used by most pages. `id` scopes the data-cta hook. */
export function closingCtas(id: string): CtaPair {
  return {
    primary: { ...CTA_CREATE_COMPANY, dataCta: `${id}-closing-primary` },
    secondary: { ...CTA_WATCH_DEMO, dataCta: `${id}-closing-secondary` },
  };
}
