import { closingCtas } from "./ctas";
import type { PageContent } from "./types";

export const ABOUT: PageContent = {
  path: "/about",
  metaTitle: "About Agentopia: an honest AI company workspace",
  metaDescription:
    "Agentopia is a workspace for running a company of AI employees. Our principles: show real work, label what is simulated and keep you in control.",
  h1: "About Agentopia",
  lead: "Agentopia is a workspace for running a small company staffed by AI employees, with a manager, an office and a record of everything they do.",
  sections: [
    {
      id: "why",
      heading: "Why an office",
      body: [
        "Coding agents are powerful but hard to follow when several of them work at once. An office gives each one a desk, a role and a visible state, so you can tell at a glance who is working, who is waiting on you and what is done.",
      ],
    },
    {
      id: "principles",
      heading: "Principles",
      bullets: [
        { title: "Real work, shown truthfully", body: "Office animation comes from persisted events. If it did not happen in the data, it does not happen on screen." },
        { title: "Simulated is always labelled", body: "The visitor demo, simulated runs and the visuals on this site are marked as scripted or illustrative." },
        { title: "No invented numbers", body: "Costs carry their source. Subscription quota is shown as unavailable. Employee experience comes only from recorded evidence." },
        { title: "Your sign-in stays yours", body: "Subscriptions are used only by your own CLI on your own machine. Agentopia never asks for or stores your Claude or ChatGPT login." },
        { title: "No surprise charges", body: "There is no automatic switch to a paid API key. API-key mode is explicit and acknowledged." },
        { title: "You have the final say", body: "Risky actions need approval, deliverables are reviewed and learned knowledge waits for your approval." },
      ],
    },
    {
      id: "not-yet",
      heading: "What Agentopia does not do",
      bullets: [
        { body: "It does not retrain models. Employees improve through approved knowledge and better context." },
        { body: "It does not run Claude or ChatGPT subscriptions on a hosted server." },
        { body: "It does not have a marketplace, billing or a multiplayer office today." },
      ],
    },
  ],
  related: [
    { label: "Product overview", href: "/product" },
    { label: "FAQ", href: "/faq" },
    { label: "Live demo", href: "/demo" },
  ],
  closing: { heading: "See how it feels", body: "Create a company, or watch the scripted office demo first.", ctas: closingCtas("about") },
};
