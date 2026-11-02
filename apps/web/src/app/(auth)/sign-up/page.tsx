import { redirect } from "next/navigation";

export default async function SignUpAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  redirect(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
}
