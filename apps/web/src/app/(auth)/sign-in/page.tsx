import { redirect } from "next/navigation";

/** proxy.ts sends signed-out visitors to /sign-in; the form lives at /login. */
export default async function SignInAlias({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
