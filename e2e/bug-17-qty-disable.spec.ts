import { test, expect } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

// BUG-C17: "-" must be disabled at quantity 1 (server rejects quantity 0).
test("decrement button is disabled at quantity 1 and enabled above it", async ({
  page,
  request,
}) => {
  const unique = Math.random().toString(36).slice(2, 8);
  const reg = await request.post(`${apiURL}/auth/register`, {
    data: {
      username: `bug17u${unique}`,
      email: `bug17-${Date.now()}-${unique}@example.com`,
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
  const puts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/cart")) puts.push(r.url());
  });

  await page.addInitScript((t) => {
    localStorage.setItem("auth_token", t);
  }, token);
  await page.goto("/cart");

  const minus = page.getByRole("button", { name: "-", exact: true });
  const plus = page.getByRole("button", { name: "+", exact: true });
  const qty = minus.locator("xpath=following-sibling::span[1]");

  await expect(qty).toHaveText("1");
  await expect(minus).toBeDisabled();
  expect(puts).toHaveLength(0);

  const [up] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("/cart")),
    plus.click(),
  ]);
  expect(up.status()).toBe(200);
  await expect(qty).toHaveText("2");
  await expect(minus).toBeEnabled();

  const [down] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "PUT" && r.url().includes("/cart")),
    minus.click(),
  ]);
  expect(down.status()).toBe(200);
  await expect(qty).toHaveText("1");
  await expect(minus).toBeDisabled();

  expect(errors).toEqual([]);
});
