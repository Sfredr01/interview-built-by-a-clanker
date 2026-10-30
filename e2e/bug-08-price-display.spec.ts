import { test, expect } from "@playwright/test";

// BUG-C08: persona price was multiplied by 100 ($49.99 rendered as $4999.00).
test("persona prices render in dollars", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto("/");

  const rex = page.getByRole("link").filter({ hasText: "Refactor Rex" });
  await expect(rex).toBeVisible({ timeout: 15_000 });
  await expect(rex.getByText("$49.99")).toBeVisible();
  await expect(page.getByText(/\$\d{4,}\.\d\d/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
