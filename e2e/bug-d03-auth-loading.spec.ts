import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-D03: protected routes flashed the sign-in prompt while /auth/me was in flight.
const pages = [
  { path: "/cart", content: /Your cart is empty/ },
  { path: "/checkout", content: /Nothing to checkout/ },
  { path: "/favorites", content: /You haven't favorited any personas yet/ },
];

test.describe("BUG-D03 no sign-in flash while auth loads", () => {
  for (const { path, content } of pages) {
    test(`${path} shows no sign-in prompt while /auth/me is pending`, async ({ page, request }) => {
      const unique = Math.random().toString(36).slice(2, 8);
      const res = await request.post(`${apiURL}/auth/register`, {
        data: {
          username: `d03${unique}`,
          email: `d03-${Date.now()}-${unique}@example.com`,
          password: "secret1",
        },
      });
      expect(res.status()).toBe(201);
      const { token } = await res.json();

      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });

      await page.addInitScript((t) => localStorage.setItem("auth_token", t), token);
      await page.route("**/auth/me", async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });

      const meResponse = page.waitForResponse((r) => r.url().endsWith("/auth/me"));
      await page.goto(path);
      await page.waitForTimeout(500);

      // /auth/me still pending: no sign-in prompt, no "Go to sign in" link.
      // Plain count() on purpose: toHaveCount(0) would retry until the prompt goes away.
      expect(await page.getByText(/Sign in to/).count()).toBe(0);
      expect(await page.getByRole("link", { name: "Go to sign in" }).count()).toBe(0);

      await meResponse;
      await expect(page.getByText(content)).toBeVisible();
      await expect(page.getByText(/Sign in to/)).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test("signed-out visitor sees the sign-in prompt promptly", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto("/cart");
    await expect(page.getByText("Sign in to view your cart")).toBeVisible({ timeout: 1000 });
    expect(errors).toEqual([]);
  });
});
