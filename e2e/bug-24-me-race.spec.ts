import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C24: a slow /auth/me response resolving after logout signed the user back in.
test.describe("BUG-C24 stale /auth/me after logout", () => {
  test("logout during an in-flight /auth/me stays signed out", async ({ page, request }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    const email = `c24-${Date.now()}-${unique}@example.com`;
    const res = await request.post(`${apiURL}/auth/register`, {
      data: { username: `c24${unique}`, email, password: "secret1" },
    });
    expect(res.status()).toBe(201);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.route("**/auth/me", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("secret1");

    const meResponse = page.waitForResponse((r) => r.url().endsWith("/auth/me"));
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    await meResponse;
    // Let React flush any state update from the stale response.
    await page.waitForTimeout(500);

    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("auth_token"))).toBeNull();
    expect(errors).toEqual([]);
  });
});
