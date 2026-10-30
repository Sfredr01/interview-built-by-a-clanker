import { test, expect } from "@playwright/test";

// BUG-C09: query key ignored search params, so filter changes never refetched.
test("changing a filter refetches and updates the persona list", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto("/");

  const cards = page.locator('a[href^="/personas/"]');
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });
  const initialCount = await cards.count();
  expect(initialCount).toBeGreaterThan(1);

  const requestPromise = page.waitForRequest(
    (req) =>
      req.method() === "GET" &&
      new URL(req.url()).pathname === "/personas" &&
      new URL(req.url()).searchParams.get("specialty") === "Security",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await requestPromise;

  await expect(cards).not.toHaveCount(initialCount, { timeout: 15_000 });
  expect(await cards.count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
