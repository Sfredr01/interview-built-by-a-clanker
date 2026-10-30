import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C23: rapid +/- clicks must compose; PUT is absolute so stale renders lost increments.
async function setup(page: Page, request: APIRequestContext) {
  const unique = Math.random().toString(36).slice(2, 8);
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: {
      username: `bug23u${unique}`,
      email: `bug23-${Date.now()}-${unique}@example.com`,
      password: "secret1",
    },
  });
  expect(reg.status()).toBe(201);
  const { token } = await reg.json();
  const add = await request.post(`${apiURL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { personaId: "p-001", quantity: 1 },
  });
  expect(add.ok()).toBeTruthy();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  let started = 0;
  let inflight = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/cart/")) {
      started++;
      inflight++;
    }
  });
  const done = (r: { method(): string; url(): string }) => {
    if (r.method() === "PUT" && r.url().includes("/cart/")) inflight--;
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);

  // Slow PUT responses so clicks overlap in flight.
  await page.route("**/cart/*", async (route) => {
    if (route.request().method() === "PUT") {
      await new Promise((r) => setTimeout(r, 300));
    }
    await route.continue();
  });

  await page.addInitScript((t) => {
    localStorage.setItem("auth_token", t);
  }, token);
  await page.goto("/cart");

  const minus = page.getByRole("button", { name: "-", exact: true });
  const plus = page.getByRole("button", { name: "+", exact: true });
  const qty = minus.locator("xpath=following-sibling::span[1]");
  await expect(qty).toHaveText("1");

  const settle = async () => {
    await expect.poll(() => started).toBeGreaterThan(0);
    await expect.poll(() => inflight).toBe(0);
    await page.waitForTimeout(500); // let the final refetch land
  };
  return { token, errors, minus, plus, qty, settle };
}

async function serverCart(request: APIRequestContext, token: string) {
  const res = await request.get(`${apiURL}/cart`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

test("three rapid + clicks from 1 end at 4 on UI and server", async ({ page, request }) => {
  const { token, errors, plus, qty, settle } = await setup(page, request);

  await plus.click({ delay: 0 });
  await plus.click({ delay: 0 });
  await plus.click({ delay: 0 });
  await settle();

  await expect(qty).toHaveText("4");
  const cart = await serverCart(request, token);
  expect(cart.items[0].quantity).toBe(4);
  expect(cart.total).toBeCloseTo(4 * 49.99, 2);
  expect(errors).toEqual([]);
});

test("rapid + + - from 1 ends at 2 on UI and server", async ({ page, request }) => {
  const { token, errors, minus, plus, qty, settle } = await setup(page, request);

  await plus.click({ delay: 0 });
  await plus.click({ delay: 0 });
  await minus.click({ delay: 0 });
  await settle();

  await expect(qty).toHaveText("2");
  const cart = await serverCart(request, token);
  expect(cart.items[0].quantity).toBe(2);
  expect(cart.total).toBeCloseTo(2 * 49.99, 2);
  expect(errors).toEqual([]);
});
