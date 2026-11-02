"use client";

import { HireEmployeeInput, ROLE_TEMPLATES, SPECIALTY_LABEL, type Rank, type Specialty } from "@agentopia/shared";
import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AVATAR_PALETTES, AvatarSwatch } from "@/components/avatar-swatch";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SwitchField } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import type { ProviderConnectionView } from "@/hooks/api-shapes";
import { useHireEmployee, useProviders } from "@/hooks/use-api";
import { cn, errorMessage } from "@/lib/utils";
import { PROVIDER_LABEL, RANK_OPTIONS, SIMULATED_VALUE, SPECIALTY_OPTIONS } from "./options";

type Errors = Partial<Record<"name" | "specialty" | "rank" | "model" | "form", string>>;

export function usableConnections(providers: ProviderConnectionView[] | undefined) {
  return (providers ?? []).filter((p) => !p.revokedAt && p.status !== "REVOKED");
}

export function modelsFor(p: ProviderConnectionView | undefined): string[] {
  if (!p) return [];
  const set = new Set<string>(p.models ?? []);
  if (p.defaultModel) set.add(p.defaultModel);
  return [...set];
}

export function HireEmployeeSheet({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus aria-hidden />
          Hire employee
        </Button>
      </SheetTrigger>
      {open ? <HireForm companyId={companyId} onDone={() => setOpen(false)} /> : null}
    </Sheet>
  );
}

function HireForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const providers = useProviders(companyId);
  const hire = useHireEmployee(companyId);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState<Specialty>("FRONTEND");
  const [rank, setRank] = useState<Rank>("JUNIOR");
  const [palette, setPalette] = useState<string>(AVATAR_PALETTES[0].id);
  const [connectionId, setConnectionId] = useState<string>(SIMULATED_VALUE);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [fromTemplate, setFromTemplate] = useState(true);
  const [errors, setErrors] = useState<Errors>({});

  const connections = useMemo(() => usableConnections(providers.data), [providers.data]);
  const connection = connections.find((c) => c.id === connectionId);
  const models = modelsFor(connection);
  const template = ROLE_TEMPLATES[specialty];

  function chooseConnection(id: string) {
    setConnectionId(id);
    const c = connections.find((x) => x.id === id);
    setModel(c?.defaultModel ?? modelsFor(c)[0]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const isSimulated = connectionId === SIMULATED_VALUE;
    const parsed = HireEmployeeInput.safeParse({
      name,
      specialty,
      rank,
      avatar: { palette, hair: 0, skin: 1 },
      providerConnectionId: isSimulated ? null : connectionId,
      model: isSimulated ? null : (model ?? null),
      initializeFromTemplate: fromTemplate,
      ...(fromTemplate ? { title: template.title, department: template.department } : {}),
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "name") next.name = "Enter a name between 1 and 80 characters.";
        else if (key === "specialty" || key === "rank" || key === "model") next[key] = issue.message;
        else next.form = issue.message;
      }
      setErrors(next);
      return;
    }
    if (!isSimulated && !model) {
      setErrors({ model: "Choose a model, or verify the connection on the Integrations page to load its models." });
      return;
    }
    setErrors({});
    try {
      await hire.mutateAsync(parsed.data);
      toast.success(`${parsed.data.name} hired`, { description: `${SPECIALTY_LABEL[specialty]}, desk assigned on this floor.` });
      onDone();
    } catch (err) {
      setErrors({ form: errorMessage(err, "The employee could not be hired.") });
    }
  }

  const providerOptions = [
    { value: SIMULATED_VALUE, label: "Simulated provider (no model is called)" },
    ...connections.map((c) => ({
      value: c.id,
      label: `${c.label} (${PROVIDER_LABEL[c.provider] ?? c.provider}${c.status === "VERIFIED" ? "" : ", not verified"})`,
    })),
  ];

  return (
    <SheetContent
      title="Hire employee"
      description="A new AI employee gets a desk in the room for their specialty and reports to the manager."
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" form="hire-form" pending={hire.isPending}>
            Hire employee
          </Button>
        </>
      }
    >
      <form id="hire-form" onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {errors.form ? (
          <p role="alert" className="border-l-2 border-brick-ink bg-brick-wash/60 px-3 py-2 text-sm text-brick-ink">
            {errors.form}
          </p>
        ) : null}

        <FormField label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="e.g. Mira Okafor" maxLength={80} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Specialty" error={errors.specialty}>
            <Select value={specialty} onValueChange={(v) => setSpecialty(v as Specialty)} options={SPECIALTY_OPTIONS} />
          </FormField>
          <FormField label="Rank" error={errors.rank} hint="Starting rank. Later changes come from evidence or an audited override.">
            <Select value={rank} onValueChange={(v) => setRank(v as Rank)} options={RANK_OPTIONS} />
          </FormField>
        </div>

        <section aria-labelledby="tpl-preview" className="border-l-2 border-rule-strong pl-4">
          <h3 id="tpl-preview" className="text-sm font-medium">
            {template.title}, {template.department}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{template.prompt.identity}</p>
          <p className="mt-2 text-xs text-fg-muted">
            Starter skills: {template.skills.length ? template.skills.join(", ") : "none"}. Learning topics:{" "}
            {template.topics.join(", ")}.
          </p>
        </section>

        <SwitchField
          label="Initialize from template"
          description="Fill the structured prompt, title, starter skills and learning sources from the template above. You can edit everything afterwards."
          checked={fromTemplate}
          onCheckedChange={setFromTemplate}
          className="border-y border-rule"
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Avatar palette</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar palette">
            {AVATAR_PALETTES.map((p) => {
              const checked = palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  aria-label={p.label}
                  onClick={() => setPalette(p.id)}
                  className={cn(
                    "flex size-11 cursor-pointer items-center justify-center rounded-full border-2",
                    checked ? "border-fg" : "border-transparent hover:border-rule-strong",
                  )}
                >
                  <AvatarSwatch name={name || "New hire"} palette={p.id} size="md" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Provider connection"
            hint={
              providers.isError
                ? "Connections could not be loaded; the simulated provider is still available."
                : connections.length === 0
                  ? "No connections yet. Add an API key on the Integrations page."
                  : undefined
            }
          >
            <Select value={connectionId} onValueChange={chooseConnection} options={providerOptions} disabled={providers.isLoading} />
          </FormField>
          <FormField label="Model" error={errors.model}>
            {connectionId === SIMULATED_VALUE ? (
              <Input value="Simulated" disabled readOnly />
            ) : (
              <Select
                value={model}
                onValueChange={setModel}
                placeholder={models.length ? "Choose a model" : "Verify the connection first"}
                options={models.map((m) => ({ value: m, label: m }))}
                disabled={!models.length}
              />
            )}
          </FormField>
        </div>
      </form>
    </SheetContent>
  );
}
