import { z } from "zod";

export const EmailField = z.email("Enter a valid email address.").max(200);
export const PasswordField = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");

export const LoginSchema = z.object({ email: EmailField, password: z.string().min(1, "Enter your password.") });
export const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: EmailField,
  password: PasswordField,
});
export const ForgotSchema = z.object({ email: EmailField });
export const ResetSchema = z
  .object({ password: PasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords do not match." });

/** zod issues → { field: firstMessage } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Only same-site relative paths are allowed as post-auth destinations. */
export function safeNext(raw: string | null | undefined, fallback = "/office"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** better-auth returns { error: { message, code, status } } instead of throwing. */
export function authErrorMessage(error: { message?: string; code?: string; status?: number } | null | undefined, fallback: string) {
  if (!error) return fallback;
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return error.message || fallback;
}
