"use client";

import { ArrowDown, ArrowUp, Copy } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toaster";
import type { MeResponse } from "@/hooks/api-shapes";
import { useCreateCompany, useCreateFloor, useRenameBuilding, useUpdateFloor } from "@/hooks/use-api";
import { useCompany } from "@/hooks/use-company";
import { errorMessage } from "@/lib/utils";
import { InlineRename } from "./inline-rename";

type Building = MeResponse["buildings"][number];
type Floor = Building["floors"][number];

export function BuildingSection({ timezone }: { timezone: string }) {
  const { me, floorId } = useCompany();
  const buildings = (me?.buildings ?? []).filter((b) => !b.isDemo);
  return (
    <section id="building" aria-labelledby="building-h" className="flex scroll-mt-8 flex-col gap-8">
      <SectionHeader
        title={<span id="building-h">Building and floors</span>}
        description="A building groups your floors; each floor hosts one company. Floor order is the order in the floor switcher."
        className="border-b border-rule"
      />
      {buildings.length === 0 ? (
        <EmptyState title="No building yet" description="Your first building is created with your first company." />
      ) : (
        buildings.map((b) => <BuildingBlock key={b.id} building={b} currentFloorId={floorId} timezone={timezone} />)
      )}
    </section>
  );
}

function BuildingBlock({ building, currentFloorId, timezone }: { building: Building; currentFloorId: string | null; timezone: string }) {
  const rename = useRenameBuilding();
  const update = useUpdateFloor();
  const floors = [...building.floors].sort((a, z) => a.order - z.order);
  const canEdit = building.isOwner;

  async function move(index: number, dir: -1 | 1) {
    const a = floors[index];
    const b = floors[index + dir];
    if (!a || !b) return;
    try {
      // Swap positions; if orders collide, fall back to index-based order.
      const aOrder = a.order === b.order ? index + dir : b.order;
      const bOrder = a.order === b.order ? index : a.order;
      await update.mutateAsync({ id: a.id, order: aOrder });
      await update.mutateAsync({ id: b.id, order: bOrder });
    } catch (err) {
      toast.error("Reorder failed", { description: errorMessage(err) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-xl font-semibold tracking-tight">
        {canEdit ? (
          <InlineRename value={building.name} label="Building name" onSave={(name) => rename.mutateAsync({ id: building.id, name })} />
        ) : (
          building.name
        )}
      </h3>
      <ol className="flex flex-col border-t border-rule">
        {floors.map((f, i) => (
          <FloorRow
            key={f.id}
            floor={f}
            buildingId={building.id}
            current={f.id === currentFloorId}
            canEdit={canEdit}
            isFirst={i === 0}
            isLast={i === floors.length - 1}
            onMove={(dir) => move(i, dir)}
            moving={update.isPending}
          />
        ))}
      </ol>
      {canEdit ? (
        <div className="grid gap-6 min-[900px]:grid-cols-2">
          <AddFloorForm buildingId={building.id} />
          <AddCompanyForm buildingId={building.id} timezone={timezone} />
        </div>
      ) : null}
    </div>
  );
}

function FloorRow({
  floor: f,
  buildingId,
  current,
  canEdit,
  isFirst,
  isLast,
  onMove,
  moving,
}: {
  floor: Floor;
  buildingId: string;
  current: boolean;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  moving: boolean;
}) {
  const update = useUpdateFloor();
  const create = useCreateFloor();
  return (
    <li className="flex flex-col gap-2 border-b border-rule py-3 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {canEdit ? <InlineRename value={f.name} label="Floor name" onSave={(name) => update.mutateAsync({ id: f.id, name })} /> : f.name}
          {current ? <Badge tone="sky">Current</Badge> : null}
        </div>
        <span className="text-sm text-fg-muted">{f.company ? f.company.name : "Empty floor"}</span>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={`Move ${f.name} up`} disabled={isFirst || moving} onClick={() => onMove(-1)}>
            <ArrowUp aria-hidden />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Move ${f.name} down`} disabled={isLast || moving} onClick={() => onMove(1)}>
            <ArrowDown aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            pending={create.isPending}
            onClick={async () => {
              try {
                await create.mutateAsync({ buildingId, name: `${f.name} copy`.slice(0, 80) });
                toast.success("Layout duplicated", { description: `Created “${f.name} copy” with the standard room layout.` });
              } catch (err) {
                toast.error("Duplicate failed", { description: errorMessage(err) });
              }
            }}
          >
            <Copy aria-hidden />
            Duplicate layout
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="danger-outline">
                Archive
              </Button>
            }
            title={`Archive ${f.name}?`}
            description={
              f.company
                ? `The floor disappears from the switcher. ${f.company.name} keeps its data, but nobody can see it from this building until the floor is restored.`
                : "The empty floor disappears from the switcher."
            }
            confirmLabel="Archive floor"
            onConfirm={async () => {
              try {
                await update.mutateAsync({ id: f.id, archived: true });
                toast.success(`${f.name} archived`);
              } catch (err) {
                toast.error("Archive failed", { description: errorMessage(err) });
              }
            }}
          />
        </div>
      ) : null}
    </li>
  );
}

function AddFloorForm({ buildingId }: { buildingId: string }) {
  const create = useCreateFloor();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length > 80) {
      setError("Use 1 to 80 characters.");
      return;
    }
    try {
      await create.mutateAsync({ buildingId, name: n });
      toast.success("Floor added", { description: n });
      setName("");
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-l-2 border-rule pl-4">
      <h4 className="text-sm font-semibold">Add an empty floor</h4>
      <FormField label="Floor name" error={error}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Second floor" maxLength={80} />
      </FormField>
      <div>
        <Button type="submit" variant="secondary" pending={create.isPending}>
          Add floor
        </Button>
      </div>
    </form>
  );
}

function AddCompanyForm({ buildingId, timezone }: { buildingId: string; timezone: string }) {
  const create = useCreateCompany();
  const { setFloor } = useCompany();
  const [name, setName] = useState("");
  const [floorName, setFloorName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const fl = floorName.trim();
    const next: Record<string, string> = {};
    if (!n || n.length > 80) next.name = "Give the company a name, up to 80 characters.";
    if (fl.length > 80) next.floorName = "Up to 80 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const r = await create.mutateAsync({ name: n, timezone, buildingId, ...(fl ? { floorName: fl } : {}) });
      toast.success(`${n} is open`, { description: "It has its own floor, a manager and a default learning schedule." });
      setName("");
      setFloorName("");
      if (r?.floorId) setFloor(r.floorId);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 border-l-2 border-rule pl-4">
      <h4 className="text-sm font-semibold">Open another company</h4>
      <p className="text-xs leading-relaxed text-fg-muted">Each company gets a new floor in this building with the standard rooms and a manager.</p>
      <FormField label="Company name" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </FormField>
      <FormField label="Floor name" optional hint="Defaults to the company name." error={errors.floorName}>
        <Input value={floorName} onChange={(e) => setFloorName(e.target.value)} maxLength={80} />
      </FormField>
      {errors.form ? (
        <p role="alert" className="text-sm font-medium text-brick-ink">
          {errors.form}
        </p>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" pending={create.isPending}>
          Open company
        </Button>
      </div>
    </form>
  );
}
