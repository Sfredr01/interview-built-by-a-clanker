import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C13: nav cart badge used ["cart-count"], which cart invalidations (["cart"]) never refreshed.
test.describe("BUG-C13 nav cart badge", () => {
  test("badge follows add, quantity change and remove without reload", async ({ page, request }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    const reg = await request.post(`${apiURL}/auth/register`, {
      data: { username: `c13${unique}`, email: `c13-${Date.now()}-${unique}@example.com`, password: "secret1" },
    });
    expect(reg.status()).toBe(201);
    const { token } = await reg.json();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.addInitScript((t) => localStorage.setItem("auth_token", t), token);
    await page.goto("/personas/p-001");

    // Badge is the pill inside the nav cart link; absent when count is 0.
    const badge = page.locator('nav a[href="/cart"] span.rounded-full');
    await expect(badge).toHaveCount(0);

    await page.getByRole("button", { name: "Add to Cart" }).click();
    await expect(badge).toHaveText("1", { timeout: 10_000 });

    await page.locator('nav a[href="/cart"]').click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();

    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(badge).toHaveText("2", { timeout: 10_000 });

    await page.getByRole("button", { name: "-", exact: true }).click();
    await expect(badge).toHaveText("1", { timeout: 10_000 });

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(badge).toHaveCount(0, { timeout: 10_000 });

    expect(errors).toEqual([]);
  });
});
