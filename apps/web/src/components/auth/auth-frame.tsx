import { BrandLogo } from "@/components/brand/logo";
import type { ReactNode } from "react";

/** Two-panel auth frame: a navy chrome panel that names the product, and the form on the page surface. */
export function AuthFrame({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface min-[900px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="flex flex-col justify-between gap-10 border-chrome-rule bg-chrome min-[900px]:border-r px-6 py-8 text-chrome-fg min-[900px]:px-12 min-[900px]:py-12">
        <BrandLogo href="/" size="md" tone="dark-surface" className="self-start" />
        <div className="hidden max-w-sm flex-col gap-4 min-[900px]:flex">
          <p className="font-display text-3xl leading-tight font-semibold tracking-tight">
            A small company of AI employees, working at their desks.
          </p>
          <p className="text-sm leading-relaxed text-chrome-muted">
            Hire a team, give the manager a task, and watch the lamps come on as the work moves from desk to desk.
          </p>
        </div>
        <p className="hidden text-xs text-chrome-muted min-[900px]:block">
          Works with Claude Code and OpenAI Codex through your own sign-in. Until you connect one, employees run on a clearly labelled simulated provider.
        </p>
      </aside>
      <main id="main" className="flex items-start justify-center px-4 py-10 min-[900px]:items-center min-[900px]:px-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="text-sm leading-relaxed text-fg-muted">{description}</p> : null}
          </header>
          {children}
          {footer ? <div className="border-t border-rule pt-5 text-sm text-fg-muted">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="border-l-2 border-brick-ink bg-brick-wash/60 px-3 py-2.5 text-sm text-fg">
      {children}
    </p>
  );
}
