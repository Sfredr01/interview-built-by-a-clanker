import { test, expect } from "@playwright/test";

// BUG-C22: every partially filled star must reference its own unique gradient.
test("partial stars use unique gradients matching their own rating", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.locator("svg linearGradient").first()).toBeAttached();

  const result = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("linearGradient")).map((g) => g.id);
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);

    const refs: { ref: string; count: number }[] = [];
    const mismatches: string[] = [];
    const fractions = new Set<number>();

    for (const label of Array.from(document.querySelectorAll("span"))) {
      const text = label.textContent?.trim() ?? "";
      if (!/^\d\.\d$/.test(text)) continue;
      const rating = Number(text);
      const expected = rating - Math.floor(rating);
      const row = label.parentElement!;
      for (const svg of Array.from(row.querySelectorAll("svg"))) {
        const fill = svg.getAttribute("fill") ?? "";
        const m = fill.match(/^url\(#(.+)\)$/);
        if (!m) continue;
        const id = m[1];
        const matches = Array.from(document.querySelectorAll("linearGradient")).filter((g) => g.id === id);
        refs.push({ ref: id, count: matches.length });
        const stop = matches[0]?.querySelector("stop");
        const offset = parseFloat(stop?.getAttribute("offset") ?? "NaN") / 100;
        fractions.add(Math.round(expected * 10));
        // rating text is rounded to 1 decimal: allow 0.05 slack
        if (!(Math.abs(offset - expected) <= 0.051)) {
          mismatches.push(`rating ${text}: expected ~${expected.toFixed(2)} got ${offset} (id ${id})`);
        }
      }
    }
    return { duplicateIds, refs, mismatches, fractionCount: fractions.size };
  });

  expect(result.refs.length).toBeGreaterThan(1);
  expect(result.fractionCount).toBeGreaterThan(1);
  expect(result.duplicateIds).toEqual([]);
  for (const r of result.refs) expect(r.count).toBe(1);
  expect(result.mismatches).toEqual([]);
  expect(errors).toEqual([]);
});
