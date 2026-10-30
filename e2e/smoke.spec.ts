import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

test("api health", async ({ request }) => {
  const res = await request.get(`${apiURL}/health`);
  expect(res.status()).toBe(200);
});

test("storefront renders persona list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Refactor Rex").first()).toBeVisible();
});
