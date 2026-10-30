import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;

async function registerUser(request: APIRequestContext, prefix: string) {
  const unique = Math.random().toString(36).slice(2, 8);
  const email = `${prefix}-${Date.now()}-${unique}@example.com`;
  const res = await request.post(`${apiURL}/auth/register`, {
    data: { username: `${prefix}${unique}`, email, password: "secret1" },
  });
  expect(res.status()).toBe(201);
  const { token } = await res.json();
  return { email, token: token as string };
}

async function uiLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("secret1");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

// BUG-C12: logout left auth_token in localStorage and the React Query cache populated.
test.describe("BUG-C12 logout", () => {
  test("logout clears the stored token and the session does not return on reload", async ({ page, request }) => {
    const a = await registerUser(request, "c12a");
    const add = await request.post(`${apiURL}/cart`, {
      headers: { Authorization: `Bearer ${a.token}` },
      data: { personaId: "p-001", quantity: 1 },
    });
    expect(add.ok()).toBeTruthy();

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await uiLogin(page, a.email);
    await page.locator('a[href="/cart"]').first().click();
    await expect(page.getByText("Refactor Rex").first()).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    expect(await page.evaluate(() => localStorage.getItem("auth_token"))).toBeNull();

    const authedRequests: string[] = [];
    page.on("request", (r) => {
      if (r.headers()["authorization"]) authedRequests.push(r.url());
    });
    await page.reload();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    expect(authedRequests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("next user does not see previous user's cart after logout", async ({ page, request }) => {
    const a = await registerUser(request, "c12a");
    const b = await registerUser(request, "c12b");
    await request.post(`${apiURL}/cart`, {
      headers: { Authorization: `Bearer ${a.token}` },
      data: { personaId: "p-001", quantity: 1 },
    });

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await uiLogin(page, a.email);
    await page.locator('a[href="/cart"]').first().click();
    await expect(page.getByText("Refactor Rex").first()).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    // Client-side navigation to login keeps the React Query cache alive.
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByLabel("Email").fill(b.email);
    await page.getByLabel("Password").fill("secret1");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.locator('a[href="/cart"]').first().click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(/empty/i).first()).toBeVisible();
    await expect(page.getByText("Refactor Rex")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
