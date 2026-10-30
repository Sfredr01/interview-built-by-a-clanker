import { test, expect } from "@playwright/test";

// BUG-C21: SearchBar overwrote the input from the URL prop while the user was still typing,
// and re-armed its debounce on every parent render.
const isPersonasGet = (url: string, q?: string) => {
  const u = new URL(url);
  return u.pathname === "/personas" && (q === undefined || u.searchParams.get("q") === q);
};

test("typing across the debounce boundary keeps every character", async ({ page }) => {
  const queries: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "GET" && isPersonasGet(req.url())) {
      queries.push(new URL(req.url()).searchParams.get("q") ?? "");
    }
  });

  await page.goto("/");
  const input = page.getByPlaceholder(/^Search personas/);
  await expect(page.locator('a[href^="/personas/"]').first()).toBeVisible({ timeout: 15_000 });

  // Deterministic race: the instant the debounce commits "ref" to the URL (before the
  // new prop reaches the component), the user types one more character.
  await page.evaluate(() => {
    const el = document.querySelector<HTMLInputElement>('input[placeholder^="Search personas"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    let fired = false;
    for (const method of ["pushState", "replaceState"] as const) {
      const orig = history[method].bind(history);
      history[method] = (...args: Parameters<History["pushState"]>) => {
        orig(...args);
        if (!fired && String(args[2]).includes("q=ref")) {
          fired = true;
          setter.call(el, "refa");
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
    }
  });

  await input.click();
  await input.pressSequentially("ref");

  // "refa" settles via its own debounce, so wait for that request, then check nothing was lost.
  await page.waitForRequest((r) => isPersonasGet(r.url(), "refa"), { timeout: 15_000 });
  await expect(input).toHaveValue("refa");
  await expect(page).toHaveURL(/q=refa/);
  expect(queries).toContain("refa");

  await input.fill("refactor");
  await page.waitForRequest((r) => isPersonasGet(r.url(), "refactor"), { timeout: 15_000 });
  await expect(input).toHaveValue("refactor");
  await expect(page).toHaveURL(/q=refactor/);
  await expect(page.getByText("Refactor Rex").first()).toBeVisible({ timeout: 15_000 });
});

test("clear button empties input and removes q; back restores previous q", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder(/^Search personas/);
  await expect(page.locator('a[href^="/personas/"]').first()).toBeVisible({ timeout: 15_000 });

  await input.fill("rex");
  await expect(page).toHaveURL(/q=rex/);
  await input.fill("rexx");
  await expect(page).toHaveURL(/q=rexx/);

  await page.goBack();
  await expect(page).toHaveURL(/q=rex(&|$)/);
  await expect(input).toHaveValue("rex");

  await input.locator("xpath=following-sibling::button").click();
  await expect(input).toHaveValue("");
  await expect(page).not.toHaveURL(/q=/);
});
