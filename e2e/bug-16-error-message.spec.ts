import { test, expect } from "@playwright/test";

test.describe("BUG-C16 readable API error messages", () => {
  test("register validation failure shows field message, not [object Object]", async ({
    page,
  }) => {
    const unique = Math.random().toString(36).slice(2, 8);
    await page.goto("/register");
    // 31 chars: passes the form's minLength=3 but fails the API's max(30).
    await page.fill("#username", "a".repeat(31));
    await page.fill("#email", `bug16-${Date.now()}-${unique}@example.com`);
    await page.fill("#password", "secret1");
    await page.click('button[type="submit"]');

    const error = page.locator("p.text-red-600");
    await expect(error).toBeVisible();
    const text = (await error.textContent()) ?? "";
    expect(text.toLowerCase()).toContain("username");
    expect(text).not.toContain("[object Object]");
  });

  test("login with wrong password still shows string error", async ({
    page,
    request,
  }) => {
    const apiURL = `http://localhost:${process.env.E2E_API_PORT ?? 4001}`;
    const unique = Math.random().toString(36).slice(2, 8);
    const email = `bug16-login-${Date.now()}-${unique}@example.com`;
    const reg = await request.post(`${apiURL}/auth/register`, {
      data: { username: `bug16user${unique}`, email, password: "secret1" },
    });
    expect(reg.status()).toBe(201);

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "wrong-password");
    await page.click('button[type="submit"]');

    await expect(page.locator("p.text-red-600")).toHaveText(
      "Invalid email or password",
    );
  });
});
