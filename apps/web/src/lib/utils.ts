import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const int = new Intl.NumberFormat("en-US");

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return usd.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return int.format(value);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

/** Extracts a human message from anything thrown by the API client or fetch. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof e.error?.message === "string") return e.error.message;
    if (typeof e.message === "string") return e.message;
  }
  return fallback;
}
