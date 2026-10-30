import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C14: detail page and favorites page shared the ["favorites"] query key with different data shapes.
test.describe("BUG-C14 favorites query cache", () => {
  test("favoriting on detail page then client-side nav to /favorites lists the persona", async ({ page, request }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    const reg = await request.post(`${apiURL}/auth/register`, {
      data: { username: `c14${unique}`, email: `c14-${Date.now()}-${unique}@example.com`, password: "secret1" },
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

    const heart = page.locator('button:has(svg path[d^="M4.318"])');
    await expect(heart).toBeVisible();
    await heart.click();
    await expect(heart.locator("svg")).toHaveClass(/text-red-500/);

    // Client-side navigation keeps the React Query cache.
    await page.locator('a[href="/favorites"]').first().click();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByText("Refactor Rex").first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("anonymous visitor on detail page does not request /favorites", async ({ page }) => {
    const errors: string[] = [];
    const favoriteRequests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/favorites")) favoriteRequests.push(r.url());
    });

    await page.goto("/personas/p-001");
    await expect(page.getByText("Refactor Rex").first()).toBeVisible();
    await page.waitForTimeout(500);

    expect(favoriteRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
});
