import { expect, test } from "@playwright/test";
import { BASE, PASSWORD, uniqueEmail } from "./helpers";

test.describe("Auth", () => {
  test("protected route redirects signed-out visitors to sign in", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login\?next=%2Ftasks/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    const api = await page.request.get("/api/me");
    expect(api.status()).toBe(401);
  });

  test("sign up, sign out, wrong password, sign in", async ({ page }) => {
    const email = uniqueEmail("auth");
    await page.goto("/signup");
    // Client-side validation first.
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.getByLabel("Your name").fill("Auth Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    expect((await page.request.get("/api/me")).status()).toBe(200);

    // Create a company so the app shell (and its account menu) renders.
    const c = await page.request.post("/api/companies", { data: { name: "Auth Co", floorName: "Floor 1" } });
    expect(c.status()).toBeLessThan(300);
    await page.goto("/tasks");
    await page.getByRole("button", { name: /Account menu for Auth Tester/ }).first().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/me")).status()).toBe(401);

    // Wrong password.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password do not match an account.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // Correct password.
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    expect((await page.request.get("/api/me")).status()).toBe(200);
  });

  test("duplicate email shows an error on sign up", async ({ page }) => {
    const email = uniqueEmail("dup");
    const r = await page.request.post("/api/auth/sign-up/email", { data: { name: "Dup", email, password: PASSWORD }, headers: { origin: BASE } });
    expect(r.status()).toBe(200);
    await page.context().clearCookies();
    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Dup Again");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/already exists/)).toBeVisible();
  });

  test("forgot-password form submits without error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await page.getByLabel("Email").fill(uniqueEmail("forgot"));
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status").filter({ hasText: "a reset link is on its way" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
