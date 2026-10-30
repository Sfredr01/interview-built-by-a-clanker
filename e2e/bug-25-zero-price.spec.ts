import { test, expect } from "@playwright/test";

// BUG-C25: a price filter of 0 must reach the API, not be treated as unset.
function trackErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test("maxPrice=0 is sent to the API and shows no personas", async ({ page }) => {
  const errors = trackErrors(page);
  const request = page.waitForRequest(
    (r) => /\/personas\?/.test(r.url()) && r.url().includes("maxPrice=0"),
    { timeout: 5000 },
  );
  await page.goto("/?maxPrice=0");
  await request;
  await expect(page.getByText("No personas found matching your criteria.")).toBeVisible();
  await expect(page.locator('a[href^="/personas/"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("minPrice=0 is sent to the API and shows all personas", async ({ page }) => {
  const errors = trackErrors(page);
  const request = page.waitForRequest(
    (r) => /\/personas\?/.test(r.url()) && r.url().includes("minPrice=0"),
    { timeout: 5000 },
  );
  await page.goto("/?minPrice=0");
  await request;
  await expect(page.locator('a[href^="/personas/"]')).toHaveCount(15);
  expect(errors).toEqual([]);
});
